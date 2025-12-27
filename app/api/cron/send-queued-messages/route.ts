import { NextRequest, NextResponse } from "next/server";

import {
	getPendingQueuedMessages,
	getUserById,
	updateQueuedMessageStatus,
} from "@/lib/db/queries";
import { getTwilioConfig } from "@/lib/config/server";
import {
	createTwilioClient,
	sendWhatsAppMessageWithRetry,
} from "@/app/api/whatsapp/twilio";
import { normalizeWhatsAppNumber } from "@/app/api/whatsapp/utils";

const CRON_SECRET = process.env["CRON_SECRET"];

export async function GET(request: NextRequest) {
	// Verify cron secret (Vercel sends it as Authorization header)
	const authHeader = request.headers.get("authorization");
	if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const pendingMessages = await getPendingQueuedMessages(50);

		if (pendingMessages.length === 0) {
			return NextResponse.json({
				status: "ok",
				processed: 0,
				message: "No pending messages",
			});
		}

		const client = createTwilioClient();
		const { whatsappFrom } = getTwilioConfig();
		const normalizedFrom = whatsappFrom
			? normalizeWhatsAppNumber(whatsappFrom)
			: undefined;

		const results = {
			sent: 0,
			failed: 0,
			errors: [] as string[],
		};

		for (const queuedMsg of pendingMessages) {
			try {
				// Get user's phone number
				const userRecord = await getUserById(queuedMsg.userId);

				if (!userRecord) {
					await updateQueuedMessageStatus({
						id: queuedMsg.id,
						status: "failed",
						error: "User not found",
					});
					results.failed++;
					results.errors.push(`${queuedMsg.id}: User not found`);
					continue;
				}

				await sendWhatsAppMessageWithRetry({
					client,
					to: userRecord.phone,
					from: normalizedFrom,
					response: queuedMsg.content,
					correlation: {
						messageSid: `queued-${queuedMsg.id}`,
					},
				});

				await updateQueuedMessageStatus({
					id: queuedMsg.id,
					status: "sent",
					sentAt: new Date(),
				});
				results.sent++;
			} catch (error) {
				const errorMessage =
					error instanceof Error ? error.message : String(error);
				await updateQueuedMessageStatus({
					id: queuedMsg.id,
					status: "failed",
					error: errorMessage,
				});
				results.failed++;
				results.errors.push(`${queuedMsg.id}: ${errorMessage}`);
			}
		}

		return NextResponse.json({
			status: "ok",
			processed: pendingMessages.length,
			sent: results.sent,
			failed: results.failed,
			errors: results.errors.length > 0 ? results.errors : undefined,
		});
	} catch (error) {
		console.error("Cron job failed:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 },
		);
	}
}
