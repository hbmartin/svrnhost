import "server-only";

import {
	createTwilioClient,
	sendTemplateMessageWithRetry,
	type SendMessageResult,
	type TwilioClient,
} from "@/app/api/whatsapp/twilio";

export interface SendTemplateParams {
	contentSid: string;
	to: string;
	contentVariables?: Record<string, string>;
	from?: string;
}

export interface BulkSendResult {
	sent: Array<{ phone: string; messageSid: string }>;
	failed: Array<{ phone: string; error: string }>;
}

/**
 * Send a template message to a single recipient.
 * Uses rate limiting and retry logic.
 */
export async function sendTemplate(
	params: SendTemplateParams,
): Promise<SendMessageResult> {
	const client = createTwilioClient();

	return sendTemplateMessageWithRetry({
		client,
		to: params.to,
		from: params.from,
		contentSid: params.contentSid,
		contentVariables: params.contentVariables,
	});
}

/**
 * Send a template to multiple recipients with rate limiting.
 * Processes sequentially to respect Twilio's 80 MPS limit.
 */
export async function sendTemplateBulk(
	contentSid: string,
	recipients: string[],
	contentVariables?: Record<string, string>,
	from?: string,
): Promise<BulkSendResult> {
	const client = createTwilioClient();
	const result: BulkSendResult = {
		sent: [],
		failed: [],
	};

	for (const phone of recipients) {
		try {
			const sendResult = await sendTemplateMessageWithRetry({
				client,
				to: phone,
				from,
				contentSid,
				contentVariables,
			});

			result.sent.push({
				phone,
				messageSid: sendResult.sid,
			});
		} catch (error) {
			result.failed.push({
				phone,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	return result;
}

/**
 * Send a template to multiple recipients using an existing client.
 * Useful when you want to control the client lifecycle.
 */
export async function sendTemplateBulkWithClient(
	client: TwilioClient,
	contentSid: string,
	recipients: string[],
	contentVariables?: Record<string, string>,
	from?: string,
): Promise<BulkSendResult> {
	const result: BulkSendResult = {
		sent: [],
		failed: [],
	};

	for (const phone of recipients) {
		try {
			const sendResult = await sendTemplateMessageWithRetry({
				client,
				to: phone,
				from,
				contentSid,
				contentVariables,
			});

			result.sent.push({
				phone,
				messageSid: sendResult.sid,
			});
		} catch (error) {
			result.failed.push({
				phone,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}

	return result;
}
