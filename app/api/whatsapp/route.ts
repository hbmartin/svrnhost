/**
 * WhatsApp Webhook Handler - Twilio Integration
 *
 * Security Flow:
 * 1. Validate payload schema (400 on failure)
 * 2. Check X-Twilio-Signature header presence (403 if missing)
 * 3. Validate signature using TWILIO_AUTH_TOKEN (403 if invalid)
 * 4. Create pending log for idempotency (skip duplicates, 500 on DB error)
 * 5. Queue async processing via next/server after()
 *
 * User Not Found Behavior:
 * - Unknown phone numbers are REJECTED (not provisioned)
 * - Logged as "processing_error" with "User not found" message
 * - To enable a user, add their WhatsApp phone to the users table
 *
 * HTTP Status Codes:
 * - 200: Success (with TwiML response)
 * - 400: Invalid/missing payload
 * - 403: Missing or invalid Twilio signature
 * - 500: Server misconfiguration (missing env vars) or DB error
 */
import { after } from "next/server";
import { createPendingLog, logWebhookError } from "./repository";
import { processWhatsAppMessage } from "./service";
import { validateTwilioRequest } from "./twilio";
import { incomingMessageSchema } from "./types";

export async function POST(request: Request) {
	const rawBody = await request.text();
	console.log("[whatsapp:webhook] received payload", {
		contentLength: rawBody.length,
		url: request.url,
	});

	if (!rawBody) {
		return new Response("Missing payload", { status: 400 });
	}

	const rawParams = Object.fromEntries(new URLSearchParams(rawBody));
	const parsedPayload = incomingMessageSchema.safeParse(rawParams);

	if (!parsedPayload.success) {
		console.warn("[whatsapp:webhook] payload failed validation", {
			issues: parsedPayload.error.issues,
		});

		after(() =>
			logWebhookError("invalid_payload", undefined, undefined, {
				issues: parsedPayload.error.format(),
				requestUrl: request.url,
			}),
		);

		return new Response("Invalid payload", { status: 400 });
	}

	const payload = parsedPayload.data;
	const signature = request.headers.get("x-twilio-signature");
	const webhookUrl = process.env.TWILIO_WHATSAPP_WEBHOOK_URL?.trim();

	if (!signature) {
		console.warn("[whatsapp:webhook] missing signature header");
		after(() =>
			logWebhookError("missing_signature", undefined, undefined, payload),
		);
		return new Response("Forbidden", { status: 403 });
	}

	if (!process.env.TWILIO_AUTH_TOKEN) {
		console.error("[whatsapp:webhook] missing TWILIO_AUTH_TOKEN");
		return new Response("Server misconfigured", { status: 500 });
	}

	if (!webhookUrl) {
		console.error("[whatsapp:webhook] missing TWILIO_WHATSAPP_WEBHOOK_URL");
		return new Response("Server misconfigured", { status: 500 });
	}

	const isValidRequest = validateTwilioRequest(
		signature,
		webhookUrl,
		rawParams,
	);

	if (!isValidRequest) {
		console.warn("[whatsapp:webhook] signature validation failed", {
			webhookUrl,
			messageSid: payload.MessageSid,
		});
		after(() =>
			logWebhookError("signature_failed", payload.MessageSid, undefined, {
				...payload,
				fromNumber: payload.From,
				toNumber: payload.To,
			}),
		);
		return new Response("Forbidden", { status: 403 });
	}

	console.log("[whatsapp:webhook] signature validated", {
		messageSid: payload.MessageSid,
	});

	const pendingLog = await createPendingLog(webhookUrl, payload);

	if (pendingLog.outcome === "duplicate") {
		console.log("[whatsapp:webhook] duplicate detected, skipping", {
			messageSid: payload.MessageSid,
		});

		return new Response("<Response></Response>", {
			status: 200,
			headers: { "Content-Type": "text/xml" },
		});
	}

	if (pendingLog.outcome === "error") {
		console.error("[whatsapp:webhook] failed to persist pending log", {
			messageSid: payload.MessageSid,
		});
		after(() =>
			logWebhookError(
				"pending_log_failed",
				payload.MessageSid,
				"createPendingLog returned outcome=error",
				{ requestUrl: request.url, webhookUrl },
			),
		);
		return new Response("Server misconfigured", { status: 500 });
	}

	after(() =>
		processWhatsAppMessage({
			payload,
			requestUrl: webhookUrl,
		}),
	);

	return new Response("<Response></Response>", {
		status: 200,
		headers: { "Content-Type": "text/xml" },
	});
}
