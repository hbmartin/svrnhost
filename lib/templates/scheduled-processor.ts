import "server-only";

import {
	getPendingScheduledMessages,
	getTemplateByContentSid,
	updateScheduledMessageStatus,
} from "@/lib/db/queries";
import { sendTemplateBulk } from "./send-service";

export interface ProcessResult {
	processed: number;
	succeeded: number;
	failed: number;
	errors: Array<{ id: string; error: string }>;
}

/**
 * Process all pending scheduled messages that are due.
 *
 * This function:
 * 1. Fetches messages where scheduledAt <= now and status = 'pending'
 * 2. Updates status to 'processing'
 * 3. Sends the template to all recipients
 * 4. Updates status to 'completed' or 'failed' with results
 */
export async function processPendingScheduledMessages(): Promise<ProcessResult> {
	const now = new Date();
	const result: ProcessResult = {
		processed: 0,
		succeeded: 0,
		failed: 0,
		errors: [],
	};

	// Get all pending messages that are due
	const pendingMessages = await getPendingScheduledMessages(now);

	for (const message of pendingMessages) {
		result.processed++;

		try {
			// Mark as processing
			await updateScheduledMessageStatus(message.id, "processing");

			// Get content SID from message or linked template
			let contentSid = message.contentSid;
			if (!contentSid && message.templateId) {
				// This shouldn't happen in normal flow, but handle it
				const template = await getTemplateByContentSid(message.templateId);
				contentSid = template?.contentSid ?? null;
			}

			if (!contentSid) {
				throw new Error("No content SID found for scheduled message");
			}

			// Send to all recipients
			const sendResult = await sendTemplateBulk(
				contentSid,
				message.recipients,
				message.contentVariables ?? undefined,
			);

			// Update with results
			const status =
				sendResult.failed.length === 0
					? "completed"
					: sendResult.sent.length === 0
						? "failed"
						: "completed"; // Partial success is still "completed"

			await updateScheduledMessageStatus(message.id, status, sendResult);

			if (sendResult.failed.length === 0) {
				result.succeeded++;
			} else if (sendResult.sent.length === 0) {
				result.failed++;
				result.errors.push({
					id: message.id,
					error: `All ${sendResult.failed.length} recipients failed`,
				});
			} else {
				// Partial success
				result.succeeded++;
			}
		} catch (error) {
			result.failed++;
			const errorMessage =
				error instanceof Error ? error.message : String(error);

			await updateScheduledMessageStatus(
				message.id,
				"failed",
				null,
				errorMessage,
			);

			result.errors.push({
				id: message.id,
				error: errorMessage,
			});
		}
	}

	return result;
}
