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
import { getTwilioConfig } from "@/lib/config/server";
import { logWhatsAppEvent } from "./observability";
import { createPendingLog, logWebhookError } from "./repository";
import { processWhatsAppMessage } from "./service";
import { validateTwilioRequest } from "./twilio";
import { incomingMessageSchema } from "./types";

export async function POST(request: Request) {
	const rawBody = await request.text();
	if (!rawBody) {
		logWhatsAppEvent("warn", {
			event: "whatsapp.inbound.missing_payload",
			direction: "inbound",
			requestUrl: request.url,
		});
		return new Response("Missing payload", { status: 400 });
	}

	const rawParams = Object.fromEntries(new URLSearchParams(rawBody));
	const rawMessageSid =
		typeof rawParams["MessageSid"] === "string" ? rawParams["MessageSid"] : undefined;
	const rawWaId =
		typeof rawParams["WaId"] === "string" ? rawParams["WaId"] : undefined;

	logWhatsAppEvent("info", {
		event: "whatsapp.inbound.received",
		direction: "inbound",
		messageSid: rawMessageSid,
		waId: rawWaId,
		requestUrl: request.url,
		details: {
			contentLength: rawBody.length,
		},
	});

	const parsedPayload = incomingMessageSchema.safeParse(rawParams);

	if (!parsedPayload.success) {
		logWhatsAppEvent("warn", {
			event: "whatsapp.inbound.validation_failed",
			direction: "inbound",
			messageSid: rawMessageSid,
			waId: rawWaId,
			details: {
				issues: parsedPayload.error.issues,
			},
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

	let webhookUrl: string;
	try {
		const twilioConfig = getTwilioConfig();
		webhookUrl = twilioConfig.whatsappWebhookUrl;
	} catch (configError) {
		const errorMessage =
			configError instanceof Error ? configError.message : String(configError);
		logWhatsAppEvent("error", {
			event: "whatsapp.inbound.config_error",
			direction: "inbound",
			messageSid: payload.MessageSid,
			waId: payload.WaId,
			error: errorMessage,
		});
		return new Response("Server misconfigured", { status: 500 });
	}

	if (!signature) {
		logWhatsAppEvent("warn", {
			event: "whatsapp.inbound.signature_missing",
			direction: "inbound",
			messageSid: payload.MessageSid,
			waId: payload.WaId,
			requestUrl: request.url,
		});
		after(() =>
			logWebhookError("missing_signature", undefined, undefined, payload),
		);
		return new Response("Forbidden", { status: 403 });
	}

	const isValidRequest = validateTwilioRequest(
		signature,
		webhookUrl,
		rawParams,
	);

	if (!isValidRequest) {
		logWhatsAppEvent("warn", {
			event: "whatsapp.inbound.signature_invalid",
			direction: "inbound",
			messageSid: payload.MessageSid,
			waId: payload.WaId,
			requestUrl: request.url,
			details: { webhookUrl },
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

	logWhatsAppEvent("info", {
		event: "whatsapp.inbound.signature_validated",
		direction: "inbound",
		messageSid: payload.MessageSid,
		waId: payload.WaId,
	});

	const pendingLog = await createPendingLog(webhookUrl, payload);

	if (pendingLog.outcome === "duplicate") {
		logWhatsAppEvent("info", {
			event: "whatsapp.inbound.duplicate_skipped",
			direction: "inbound",
			messageSid: payload.MessageSid,
			waId: payload.WaId,
		});

		return new Response("<Response></Response>", {
			status: 200,
			headers: { "Content-Type": "text/xml" },
		});
	}

	if (pendingLog.outcome === "error") {
		logWhatsAppEvent("error", {
			event: "whatsapp.inbound.pending_log_failed",
			direction: "inbound",
			messageSid: payload.MessageSid,
			waId: payload.WaId,
			requestUrl: request.url,
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

	logWhatsAppEvent("info", {
		event: "whatsapp.processing.queued",
		direction: "internal",
		messageSid: payload.MessageSid,
		waId: payload.WaId,
	});

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
