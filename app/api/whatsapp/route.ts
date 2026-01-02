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
import { context, trace } from "@opentelemetry/api";
import { after } from "next/server";
import { getTwilioConfig } from "@/lib/config/server";
import { bindRequestContext, runWithRequestContext } from "@/lib/observability";
import { logWhatsAppEvent, setWhatsAppSpanAttributes } from "./observability";
import { createPendingLog, logWebhookError } from "./repository";
import { processWhatsAppMessage } from "./service";
import { validateTwilioRequest } from "./twilio";
import { incomingMessageSchema } from "./types";

const tracer = trace.getTracer("whatsapp-webhook");

type ValidationResult<T> =
	| { success: true; data: T }
	| { success: false; response: Response };

function getWebhookUrl(
	requestUrl: string,
	payload: { MessageSid: string; WaId: string },
): ValidationResult<string> {
	try {
		const twilioConfig = getTwilioConfig();

		if (twilioConfig.whatsappWebhookUrl !== requestUrl) {
			logWhatsAppEvent("warn", {
				event: "whatsapp.inbound.webhook_url_mismatch",
				direction: "inbound",
				messageSid: payload.MessageSid,
				waId: payload.WaId,
				details: {
					configuredUrl: twilioConfig.whatsappWebhookUrl,
					requestUrl,
				},
			});
		}
		return { success: true, data: requestUrl };
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
		return {
			success: false,
			response: new Response("Server misconfigured", { status: 500 }),
		};
	}
}

const TWIML_EMPTY_RESPONSE = "<Response></Response>";

function createTwimlResponse(): Response {
	return new Response(TWIML_EMPTY_RESPONSE, {
		status: 200,
		headers: { "Content-Type": "text/xml" },
	});
}

interface PendingLogContext {
	payload: { MessageSid: string; WaId: string };
	requestUrl: string;
	webhookUrl: string;
	runInBackground: <T>(fn: () => T) => T;
}

type ParsePayloadResult =
	| {
			success: true;
			payload: ReturnType<typeof incomingMessageSchema.parse>;
			rawParams: Record<string, string>;
	  }
	| { success: false; response: Response };

function parseAndValidatePayload(
	rawBody: string,
	requestUrl: string,
	runInBackground: <T>(fn: () => T) => T,
): ParsePayloadResult {
	const rawParams = Object.fromEntries(new URLSearchParams(rawBody));
	const rawMessageSid =
		typeof rawParams["MessageSid"] === "string"
			? rawParams["MessageSid"]
			: undefined;
	const rawWaId =
		typeof rawParams["WaId"] === "string" ? rawParams["WaId"] : undefined;

	logWhatsAppEvent("info", {
		event: "whatsapp.inbound.received",
		direction: "inbound",
		messageSid: rawMessageSid,
		waId: rawWaId,
		requestUrl,
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
			runInBackground(() =>
				logWebhookError("invalid_payload", undefined, undefined, {
					issues: parsedPayload.error.format(),
					requestUrl,
				}),
			),
		);

		return {
			success: false,
			response: new Response("Invalid payload", { status: 400 }),
		};
	}

	return { success: true, payload: parsedPayload.data, rawParams };
}

function handlePendingLogOutcome(
	outcome: "created" | "duplicate" | "error",
	ctx: PendingLogContext,
): Response | null {
	if (outcome === "duplicate") {
		logWhatsAppEvent("info", {
			event: "whatsapp.inbound.duplicate_skipped",
			direction: "inbound",
			messageSid: ctx.payload.MessageSid,
			waId: ctx.payload.WaId,
		});
		return createTwimlResponse();
	}

	if (outcome === "error") {
		logWhatsAppEvent("error", {
			event: "whatsapp.inbound.pending_log_failed",
			direction: "inbound",
			messageSid: ctx.payload.MessageSid,
			waId: ctx.payload.WaId,
			requestUrl: ctx.requestUrl,
		});
		after(() =>
			ctx.runInBackground(() =>
				logWebhookError(
					"pending_log_failed",
					ctx.payload.MessageSid,
					"createPendingLog returned outcome=error",
					{ requestUrl: ctx.requestUrl, webhookUrl: ctx.webhookUrl },
				),
			),
		);
		return new Response("Server misconfigured", { status: 500 });
	}

	return null; // outcome === "created", continue processing
}

function validateSignature(
	signature: string | null,
	webhookUrl: string,
	rawParams: Record<string, string>,
	payload: { MessageSid: string; WaId: string; From: string; To: string },
	runInBackground: <T>(fn: () => T) => T,
	requestUrl: string,
): ValidationResult<void> {
	if (!signature) {
		logWhatsAppEvent("warn", {
			event: "whatsapp.inbound.signature_missing",
			direction: "inbound",
			messageSid: payload.MessageSid,
			waId: payload.WaId,
			requestUrl,
		});
		after(() =>
			runInBackground(() =>
				logWebhookError("missing_signature", undefined, undefined, payload),
			),
		);
		return {
			success: false,
			response: new Response("Forbidden", { status: 403 }),
		};
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
			requestUrl,
			details: { webhookUrl },
		});
		after(() =>
			runInBackground(() =>
				logWebhookError("signature_failed", payload.MessageSid, undefined, {
					...payload,
					fromNumber: payload.From,
					toNumber: payload.To,
				}),
			),
		);
		return {
			success: false,
			response: new Response("Forbidden", { status: 403 }),
		};
	}

	logWhatsAppEvent("info", {
		event: "whatsapp.inbound.signature_validated",
		direction: "inbound",
		messageSid: payload.MessageSid,
		waId: payload.WaId,
	});

	return { success: true, data: undefined };
}

export function POST(request: Request) {
	return runWithRequestContext({ request, service: "whatsapp" }, async () => {
		const runInBackground = bindRequestContext();
		const rawBody = await request.text();
		if (!rawBody) {
			logWhatsAppEvent("warn", {
				event: "whatsapp.inbound.missing_payload",
				direction: "inbound",
				requestUrl: request.url,
			});
			return new Response("Missing payload", { status: 400 });
		}

		const parseResult = parseAndValidatePayload(
			rawBody,
			request.url,
			runInBackground,
		);
		if (!parseResult.success) {
			return parseResult.response;
		}

		const { payload, rawParams } = parseResult;
		const signature = request.headers.get("x-twilio-signature");
		const requestUrl = request.url;

		const webhookResult = getWebhookUrl(requestUrl, payload);
		if (!webhookResult.success) {
			return webhookResult.response;
		}
		const webhookUrl = webhookResult.data;

		const signatureResult = validateSignature(
			signature,
			webhookUrl,
			rawParams,
			payload,
			runInBackground,
			requestUrl,
		);
		if (!signatureResult.success) {
			return signatureResult.response;
		}

		const pendingLog = await createPendingLog(webhookUrl, payload);

		const pendingLogResponse = handlePendingLogOutcome(pendingLog.outcome, {
			payload,
			requestUrl,
			webhookUrl,
			runInBackground,
		});
		if (pendingLogResponse) {
			return pendingLogResponse;
		}

		logWhatsAppEvent("info", {
			event: "whatsapp.processing.queued",
			direction: "internal",
			messageSid: payload.MessageSid,
			waId: payload.WaId,
		});

		tracer.startActiveSpan("whatsapp.webhook.pre_after", (span) => {
			setWhatsAppSpanAttributes(span, {
				event: "whatsapp.webhook.pre_after",
				direction: "internal",
				messageSid: payload.MessageSid,
				waId: payload.WaId,
				requestUrl: webhookUrl,
			});
			span.end();
		});

		// Capture the current trace context before after() runs
		// This ensures spans created in processWhatsAppMessage are linked to the original request trace
		const traceContext = context.active();

		after(() =>
			runInBackground(() =>
				context.with(traceContext, () =>
					processWhatsAppMessage({
						payload,
						requestUrl: webhookUrl,
					}),
				),
			),
		);

		return createTwimlResponse();
	});
}
