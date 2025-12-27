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
import type { IncomingMessage } from "./types";
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
	response: string;
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
}: SendMessageParams): Promise<SendMessageResult> {
	const config = getLazyTwilioConfig();
	const messagingServiceSid = config.messagingServiceSid;
	const fromNumber = from ?? config.whatsappFrom ?? undefined;
	const formattedTo = formatWhatsAppNumber(to);
	const formattedFrom = fromNumber
		? formatWhatsAppNumber(fromNumber)
		: undefined;

	const payload: MessageListInstanceCreateOptions = {
		to: formattedTo,
		body: response,
	};

	if (messagingServiceSid) {
		payload.messagingServiceSid = messagingServiceSid;
	} else if (formattedFrom) {
		payload.from = formattedFrom;
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

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Chunk a message by newlines to fit within Twilio's max message length.
 * Tries to split on newline boundaries; if a single line exceeds the limit,
 * it will be included as its own chunk (Twilio will truncate if needed).
 */
export function chunkMessageByNewlines(
	message: string,
	maxLength: number,
): string[] {
	if (!message) {
		return [];
	}
	if (message.length <= maxLength) {
		return [message];
	}

	const lines = message.split("\n");
	const chunks: string[] = [];
	let currentChunk = "";

	for (const line of lines) {
		const lineWithNewline = currentChunk ? `\n${line}` : line;

		if (currentChunk.length + lineWithNewline.length <= maxLength) {
			currentChunk += lineWithNewline;
		} else {
			if (currentChunk) {
				chunks.push(currentChunk);
			}
			// If a single line exceeds maxLength, include it as its own chunk
			currentChunk = line;
		}
	}

	if (currentChunk) {
		chunks.push(currentChunk);
	}

	// Filter out any empty chunks
	return chunks.filter((chunk) => chunk.length > 0);
}

async function sendSingleMessageWithRateLimitAndRetry(
	params: SendMessageParams,
): Promise<{ result: SendMessageResult; attempts: number }> {
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
	return withRetry(() => sendWhatsAppMessage(params), {
		maxAttempts: WHATSAPP_LIMITS.retry.maxAttempts,
		baseDelayMs: WHATSAPP_LIMITS.retry.baseDelayMs,
		maxDelayMs: WHATSAPP_LIMITS.retry.maxDelayMs,
		context: "twilio-send",
		shouldRetry: (error) => isTwilioErrorRetryable(error),
	});
}

/**
 * Send a WhatsApp message with rate limiting, retry logic, and chunking for long messages.
 *
 * - Chunking: Messages over 1600 chars are split by newlines and sent as multiple messages
 * - Rate limiting: Sender-level token bucket to respect Twilio's 80 MPS limit per WhatsApp sender
 * - Retry: Exponential backoff for transient failures
 * - Error classification: Distinguishes retryable vs permanent failures
 *
 * @returns The result from the last chunk sent (or the only message if no chunking needed)
 * @throws Error if all retries exhausted or permanent failure encountered
 */
export async function sendWhatsAppMessageWithRetry(
	params: SendMessageParams,
): Promise<SendMessageResult> {
	const { to, correlation, response } = params;

	if (!response || response.trim().length === 0) {
		throw new Error("Cannot send empty message");
	}

	const chunks = chunkMessageByNewlines(
		response,
		WHATSAPP_LIMITS.maxMessageLength,
	);

	if (chunks.length > 1) {
		logWhatsAppEvent("info", {
			event: "whatsapp.outbound.chunking",
			direction: "outbound",
			...correlation,
			toNumber: to,
			details: {
				originalLength: response.length,
				chunkCount: chunks.length,
			},
		});
	}

	const results: SendMessageResult[] = [];
	let chunkIndex = 0;

	for (const chunk of chunks) {
		// Skip empty chunks
		if (chunk.length === 0) {
			continue;
		}

		// Add delay between chunks (not before the first one)
		if (results.length > 0) {
			await sleep(WHATSAPP_LIMITS.chunkDelayMs);
		}

		const chunkParams: SendMessageParams = {
			...params,
			response: chunk,
		};

		const { result, attempts } =
			await sendSingleMessageWithRateLimitAndRetry(chunkParams);

		if (attempts > 1) {
			logWhatsAppEvent("warn", {
				event: "whatsapp.outbound.send_retried",
				direction: "outbound",
				...correlation,
				toNumber: to,
				details: {
					attempts,
					outboundMessageSid: result.sid,
					chunkIndex: chunks.length > 1 ? chunkIndex + 1 : undefined,
					totalChunks: chunks.length > 1 ? chunks.length : undefined,
				},
			});
		}

		results.push(result);
		chunkIndex++;
	}

	const lastResult = results.at(-1);
	if (!lastResult) {
		throw new Error("No message chunks to send");
	}
	return lastResult;
}
