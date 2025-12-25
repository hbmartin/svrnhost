import { SpanStatusCode, trace } from "@opentelemetry/api";
import twilio, { RestException } from "twilio";
import type { MessageListInstanceCreateOptions } from "twilio/lib/rest/api/v2010/account/message";
import { WHATSAPP_LIMITS } from "@/lib/config/limits";
import { getTwilioConfig } from "@/lib/config/server";
import { whatsappRateLimiter } from "@/lib/rate-limiter";
import { isNetworkError, isRetryableHttpStatus, withRetry } from "@/lib/retry";
import {
	logWhatsAppEvent,
	setWhatsAppSpanAttributes,
	type WhatsAppCorrelationIds,
} from "./observability";
import type { IncomingMessage, WhatsAppAIResponse } from "./types";
import { formatWhatsAppNumber } from "./utils";

export type TwilioClient = twilio.Twilio;

const tracer = trace.getTracer("whatsapp-twilio");

let cachedTwilioConfig: ReturnType<typeof getTwilioConfig> | null = null;

function getLazyTwilioConfig() {
	if (!cachedTwilioConfig) {
		cachedTwilioConfig = getTwilioConfig();
	}
	return cachedTwilioConfig;
}

export function createTwilioClient(): TwilioClient {
	const config = getLazyTwilioConfig();
	return twilio(config.accountSid, config.authToken, {
		autoRetry: true,
		maxRetries: WHATSAPP_LIMITS.twilioAutoRetryMaxRetries,
	});
}

export function validateTwilioRequest(
	signature: string,
	url: string,
	params: Record<string, string>,
): boolean {
	const config = getLazyTwilioConfig();
	return twilio.validateRequest(config.authToken, signature, url, params);
}

export interface TwilioErrorMetadata {
	status?: number | undefined;
	code?: number | undefined;
	moreInfo?: string | undefined;
	details?: Record<string, unknown> | undefined;
}

export function getTwilioErrorMetadata(
	error: unknown,
): TwilioErrorMetadata | undefined {
	if (error instanceof RestException) {
		return {
			status: error.status,
			code: error.code,
			moreInfo: error.moreInfo,
			details:
				error.details && typeof error.details === "object"
					? (error.details as Record<string, unknown>)
					: undefined,
		};
	}

	return undefined;
}

export async function sendTypingIndicator(
	client: TwilioClient,
	payload: IncomingMessage,
	correlation?: WhatsAppCorrelationIds,
): Promise<void> {
	const conversationSid = payload.ConversationSid;
	const config = getLazyTwilioConfig();
	const agentIdentity = config.conversationsAgentIdentity;
	const resolvedCorrelation: WhatsAppCorrelationIds = {
		messageSid: correlation?.messageSid ?? payload.MessageSid,
		waId: correlation?.waId ?? payload.WaId,
		chatId: correlation?.chatId,
	};

	if (!conversationSid || !agentIdentity) {
		logWhatsAppEvent("info", {
			event: "whatsapp.typing.skipped",
			direction: "outbound",
			...resolvedCorrelation,
			details: {
				reason: !conversationSid
					? "missing_conversation_sid"
					: "missing_agent_identity",
			},
		});
		return;
	}

	return tracer.startActiveSpan("twilio.typing_indicator", async (span) => {
		setWhatsAppSpanAttributes(span, {
			event: "whatsapp.typing",
			direction: "outbound",
			...resolvedCorrelation,
		});
		span.setAttribute("twilio.operation", "typing_indicator");
		span.setAttribute("twilio.conversation_sid", conversationSid);

		try {
			const participants = await client.conversations.v1
				.conversations(conversationSid)
				.participants.list();

			const agentParticipant = participants.find(
				(participant) => participant.identity === agentIdentity,
			);

			if (!agentParticipant) {
				logWhatsAppEvent("warn", {
					event: "whatsapp.typing.agent_not_found",
					direction: "outbound",
					...resolvedCorrelation,
					details: { conversationSid, agentIdentity },
				});
				span.setStatus({
					code: SpanStatusCode.ERROR,
					message: "agent_participant_not_found",
				});
				return;
			}

			await client.request({
				method: "post",
				uri: `https://conversations.twilio.com/v1/Conversations/${conversationSid}/Participants/${agentParticipant.sid}/Typing`,
			});

			logWhatsAppEvent("info", {
				event: "whatsapp.typing.sent",
				direction: "outbound",
				...resolvedCorrelation,
				details: { conversationSid },
			});

			span.setStatus({ code: SpanStatusCode.OK });
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			span.recordException(error as Error);
			span.setStatus({ code: SpanStatusCode.ERROR, message: errorMessage });
			throw error;
		} finally {
			span.end();
		}
	});
}

export interface SendMessageParams {
	client: TwilioClient;
	to: string;
	from?: string | undefined;
	response: WhatsAppAIResponse;
	correlation?: WhatsAppCorrelationIds | undefined;
	/** Optional: Override the content template SID (takes precedence over env var) */
	contentSid?: string | undefined;
	/** Optional: Variables to substitute in the template */
	contentVariables?: Record<string, string> | undefined;
}

export interface SendTemplateParams {
	client: TwilioClient;
	to: string;
	from?: string | undefined;
	contentSid: string;
	contentVariables?: Record<string, string> | undefined;
	correlation?: WhatsAppCorrelationIds | undefined;
}

export interface SendMessageResult {
	sid: string;
	status: string;
}

export async function sendWhatsAppMessage({
	client,
	to,
	from,
	response,
	correlation,
	contentSid: overrideContentSid,
	contentVariables: overrideContentVariables,
}: SendMessageParams): Promise<SendMessageResult> {
	const config = getLazyTwilioConfig();
	const messagingServiceSid = config.messagingServiceSid;
	const buttonsContentSid = config.whatsappButtonsContentSid;
	const fromNumber = from ?? config.whatsappFrom ?? undefined;
	const formattedTo = formatWhatsAppNumber(to);
	const formattedFrom = fromNumber
		? formatWhatsAppNumber(fromNumber)
		: undefined;

	const payload: MessageListInstanceCreateOptions = {
		to: formattedTo,
	};

	if (messagingServiceSid) {
		payload.messagingServiceSid = messagingServiceSid;
	} else if (formattedFrom) {
		payload.from = formattedFrom;
	}

	if (response.mediaUrl) {
		payload.mediaUrl = [response.mediaUrl];
	}

	if (response.location) {
		payload.persistentAction = [
			`geo:${response.location.latitude},${response.location.longitude}|${response.location.label ?? response.location.name}`,
		];
	}

	// Priority: explicit contentSid > buttons with env var > plain message
	if (overrideContentSid) {
		// Use explicit template override
		payload.contentSid = overrideContentSid;
		if (overrideContentVariables) {
			payload.contentVariables = JSON.stringify(overrideContentVariables);
		}
	} else if (response.buttons?.length && buttonsContentSid) {
		// Use buttons template from env var (backward compatible)
		payload.contentSid = buttonsContentSid;
		payload.contentVariables = JSON.stringify({
			message: response.message,
			buttons: response.buttons.map((button, index) => ({
				id: button.id ?? `option-${index + 1}`,
				label: button.label,
				url: button.url,
			})),
		});
	} else {
		if ((response.buttons?.length ?? 0) > 0) {
			logWhatsAppEvent("warn", {
				event: "whatsapp.outbound.buttons_ignored",
				direction: "outbound",
				...correlation,
				toNumber: to,
				fromNumber: from,
				error: "TWILIO_WHATSAPP_BUTTONS_CONTENT_SID missing",
			});
		}
		payload.body = response.message;
	}

	return tracer.startActiveSpan("twilio.messages.create", async (span) => {
		setWhatsAppSpanAttributes(span, {
			event: "whatsapp.outbound.send",
			direction: "outbound",
			...correlation,
			toNumber: to,
			fromNumber: from,
		});
		span.setAttribute("twilio.operation", "messages.create");
		span.setAttribute("twilio.to", formattedTo);
		if (formattedFrom) {
			span.setAttribute("twilio.from", formattedFrom);
		}
		if (messagingServiceSid) {
			span.setAttribute("twilio.messaging_service_sid", messagingServiceSid);
		}

		try {
			const result = await client.messages.create(payload);
			span.setAttribute("twilio.message_sid", result.sid);
			if (result.status) {
				span.setAttribute("twilio.status", result.status);
			}

			logWhatsAppEvent("info", {
				event: "whatsapp.outbound.sent",
				direction: "outbound",
				...correlation,
				toNumber: to,
				fromNumber: from,
				status: result.status ?? "unknown",
				details: { outboundMessageSid: result.sid },
			});

			span.setStatus({ code: SpanStatusCode.OK });

			return {
				sid: result.sid,
				status: result.status,
			};
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			span.recordException(error as Error);
			span.setStatus({ code: SpanStatusCode.ERROR, message: errorMessage });
			throw error;
		} finally {
			span.end();
		}
	});
}

/**
 * Check if a Twilio error is retryable.
 *
 * Retryable errors:
 * - 429 (rate limit)
 * - 500-599 (server errors)
 * - Network errors (connection reset, timeout, etc.)
 *
 * Non-retryable errors:
 * - 400 (bad request - malformed payload)
 * - 401/403 (authentication/authorization)
 * - 404 (invalid phone number or resource)
 * - Other 4xx client errors
 */
function isTwilioErrorRetryable(error: unknown): boolean {
	if (isNetworkError(error)) {
		return true;
	}

	if (error instanceof RestException) {
		return isRetryableHttpStatus(error.status);
	}

	// For unknown error types, don't retry
	return false;
}

/**
 * Sender-level rate limit key.
 * Twilio's 80 MPS limit applies per WhatsApp Business sender, not per recipient.
 * All outbound messages share this single bucket regardless of recipient.
 */
const WHATSAPP_SENDER_RATE_LIMIT_KEY = "whatsapp-sender";

/**
 * Send a WhatsApp message with rate limiting and retry logic.
 *
 * - Rate limiting: Sender-level token bucket to respect Twilio's 80 MPS limit per WhatsApp sender
 * - Retry: Exponential backoff for transient failures
 * - Error classification: Distinguishes retryable vs permanent failures
 *
 * @throws Error if all retries exhausted or permanent failure encountered
 */
export async function sendWhatsAppMessageWithRetry(
	params: SendMessageParams,
): Promise<SendMessageResult> {
	const { to, correlation } = params;

	// Acquire sender-level rate limit token (waits up to 5 seconds)
	// Twilio's 80 MPS quota is per WhatsApp sender, not per recipient
	try {
		await whatsappRateLimiter.acquire(
			WHATSAPP_SENDER_RATE_LIMIT_KEY,
			WHATSAPP_LIMITS.senderRateLimitMaxWaitMs,
		);
	} catch (rateLimitError) {
		logWhatsAppEvent("error", {
			event: "whatsapp.outbound.rate_limit_failed",
			direction: "outbound",
			...correlation,
			toNumber: to,
			error:
				rateLimitError instanceof Error
					? rateLimitError.message
					: String(rateLimitError),
		});
		throw rateLimitError;
	}

	// Send with retry
	const { result, attempts } = await withRetry(
		() => sendWhatsAppMessage(params),
		{
			maxAttempts: WHATSAPP_LIMITS.retry.maxAttempts,
			baseDelayMs: WHATSAPP_LIMITS.retry.baseDelayMs,
			maxDelayMs: WHATSAPP_LIMITS.retry.maxDelayMs,
			context: "twilio-send",
			shouldRetry: (error) => isTwilioErrorRetryable(error),
		},
	);

	if (attempts > 1) {
		logWhatsAppEvent("warn", {
			event: "whatsapp.outbound.send_retried",
			direction: "outbound",
			...correlation,
			toNumber: to,
			details: { attempts, outboundMessageSid: result.sid },
		});
	}

	return result;
}

/**
 * Send a template message directly using Content SID.
 * This is a simplified version for sending pre-approved templates.
 */
export async function sendTemplateMessage({
	client,
	to,
	from,
	contentSid,
	contentVariables,
	correlation,
}: SendTemplateParams): Promise<SendMessageResult> {
	const config = getLazyTwilioConfig();
	const messagingServiceSid = config.messagingServiceSid;
	const fromNumber = from ?? config.whatsappFrom ?? undefined;
	const formattedTo = formatWhatsAppNumber(to);
	const formattedFrom = fromNumber
		? formatWhatsAppNumber(fromNumber)
		: undefined;

	const payload: MessageListInstanceCreateOptions = {
		to: formattedTo,
		contentSid,
	};

	if (contentVariables) {
		payload.contentVariables = JSON.stringify(contentVariables);
	}

	if (messagingServiceSid) {
		payload.messagingServiceSid = messagingServiceSid;
	} else if (formattedFrom) {
		payload.from = formattedFrom;
	}

	return tracer.startActiveSpan("twilio.template.send", async (span) => {
		setWhatsAppSpanAttributes(span, {
			event: "whatsapp.template.send",
			direction: "outbound",
			...correlation,
			toNumber: to,
			fromNumber: from,
		});
		span.setAttribute("twilio.operation", "template.send");
		span.setAttribute("twilio.to", formattedTo);
		span.setAttribute("twilio.content_sid", contentSid);
		if (formattedFrom) {
			span.setAttribute("twilio.from", formattedFrom);
		}

		try {
			const result = await client.messages.create(payload);
			span.setAttribute("twilio.message_sid", result.sid);
			if (result.status) {
				span.setAttribute("twilio.status", result.status);
			}

			logWhatsAppEvent("info", {
				event: "whatsapp.template.sent",
				direction: "outbound",
				...correlation,
				toNumber: to,
				fromNumber: from,
				status: result.status ?? "unknown",
				details: { outboundMessageSid: result.sid, contentSid },
			});

			span.setStatus({ code: SpanStatusCode.OK });

			return {
				sid: result.sid,
				status: result.status,
			};
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			span.recordException(error as Error);
			span.setStatus({ code: SpanStatusCode.ERROR, message: errorMessage });
			throw error;
		} finally {
			span.end();
		}
	});
}

/**
 * Send a template message with rate limiting and retry logic.
 */
export async function sendTemplateMessageWithRetry(
	params: SendTemplateParams,
): Promise<SendMessageResult> {
	const { to, correlation } = params;

	try {
		await whatsappRateLimiter.acquire(
			WHATSAPP_SENDER_RATE_LIMIT_KEY,
			WHATSAPP_LIMITS.senderRateLimitMaxWaitMs,
		);
	} catch (rateLimitError) {
		logWhatsAppEvent("error", {
			event: "whatsapp.template.rate_limit_failed",
			direction: "outbound",
			...correlation,
			toNumber: to,
			error:
				rateLimitError instanceof Error
					? rateLimitError.message
					: String(rateLimitError),
		});
		throw rateLimitError;
	}

	const { result, attempts } = await withRetry(
		() => sendTemplateMessage(params),
		{
			maxAttempts: WHATSAPP_LIMITS.retry.maxAttempts,
			baseDelayMs: WHATSAPP_LIMITS.retry.baseDelayMs,
			maxDelayMs: WHATSAPP_LIMITS.retry.maxDelayMs,
			context: "twilio-template-send",
			shouldRetry: (error) => isTwilioErrorRetryable(error),
		},
	);

	if (attempts > 1) {
		logWhatsAppEvent("warn", {
			event: "whatsapp.template.send_retried",
			direction: "outbound",
			...correlation,
			toNumber: to,
			details: { attempts, outboundMessageSid: result.sid },
		});
	}

	return result;
}
