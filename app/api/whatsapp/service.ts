import { SpanStatusCode, trace } from "@opentelemetry/api";
import { convertToModelMessages, generateObject } from "ai";
import { myProvider } from "@/lib/ai/providers";
import {
	classifyAIError,
	FALLBACK_RESPONSE,
	getSafeErrorMessage,
	isValidWhatsAppResponse,
	LLM_CONFIG,
} from "@/lib/ai/safety";
import { convertToUIMessages } from "@/lib/utils";
import {
	findUserByPhone,
	getChatMessages,
	logAIEscalation,
	logProcessingError,
	logSendFailed,
	logTypingFailed,
	logWebhookOutbound,
	markMessageFailed,
	markMessageSent,
	resolveOrCreateChat,
	saveInboundMessage,
	saveOutboundMessage,
	updateProcessingStatus,
} from "./repository";
import {
	createTwilioClient,
	sendTypingIndicator,
	sendWhatsAppMessageWithRetry,
	type TwilioClient,
} from "./twilio";
import {
	type IncomingMessage,
	type WhatsAppAIResponse,
	whatsappResponseSchema,
} from "./types";
import {
	buildSystemPrompt,
	extractAttachments,
	normalizeWhatsAppNumber,
} from "./utils";
import {
	logWhatsAppEvent,
	setWhatsAppSpanAttributes,
	type WhatsAppCorrelationIds,
} from "./observability";

const tracer = trace.getTracer("whatsapp-webhook");

export async function processWhatsAppMessage({
	payload,
	requestUrl,
}: {
	payload: IncomingMessage;
	requestUrl: string;
}) {
	return tracer.startActiveSpan("process-whatsapp", async (span) => {
		setWhatsAppSpanAttributes(span, {
			event: "whatsapp.processing",
			direction: "inbound",
			messageSid: payload.MessageSid,
			waId: payload.WaId,
			requestUrl,
		});

		let chatId: string | undefined;

		try {
			await updateProcessingStatus(
				payload.MessageSid,
				"processing",
				requestUrl,
			);
			chatId = await handleWhatsAppMessage({ payload, requestUrl });
			if (chatId) {
				span.setAttribute("whatsapp.chat_id", chatId);
			}
			await updateProcessingStatus(payload.MessageSid, "processed");
			span.setStatus({ code: SpanStatusCode.OK });
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);

			span.recordException(error as Error);
			span.setStatus({ code: SpanStatusCode.ERROR, message: errorMessage });

			logWhatsAppEvent("error", {
				event: "whatsapp.processing.error",
				direction: "internal",
				messageSid: payload.MessageSid,
				waId: payload.WaId,
				chatId,
				requestUrl,
				error: errorMessage,
			});

			const updated = await updateProcessingStatus(
				payload.MessageSid,
				"processing_error",
				requestUrl,
				errorMessage,
			);

			if (!updated) {
				await logProcessingError(
					payload.MessageSid,
					normalizeWhatsAppNumber(payload.From),
					normalizeWhatsAppNumber(payload.To),
					requestUrl,
					errorMessage,
				);
			}
		} finally {
			span.end();
		}
	});
}

async function handleWhatsAppMessage({
	payload,
	requestUrl,
}: {
	payload: IncomingMessage;
	requestUrl: string;
}): Promise<string> {
	const correlation: WhatsAppCorrelationIds = {
		messageSid: payload.MessageSid,
		waId: payload.WaId,
	};

	logWhatsAppEvent("info", {
		event: "whatsapp.processing.started",
		direction: "inbound",
		...correlation,
		fromNumber: payload.From,
		toNumber: payload.To,
	});

	const client = createTwilioClient();
	const whatsappFrom = process.env.TWILIO_WHATSAPP_FROM;

	if (!whatsappFrom && !process.env.TWILIO_MESSAGING_SERVICE_SID) {
		throw new Error(
			"TWILIO_WHATSAPP_FROM or TWILIO_MESSAGING_SERVICE_SID is required",
		);
	}

	const normalizedFrom = normalizeWhatsAppNumber(payload.From);
	const normalizedTo = normalizeWhatsAppNumber(payload.To);

	const user = await findUserByPhone(normalizedFrom);

	/**
	 * User Not Found Behavior Decision:
	 * We REJECT messages from unregistered phone numbers rather than creating provisional users.
	 *
	 * Rationale:
	 * - Security: Only pre-registered users can interact with the system
	 * - Prevents abuse from unknown numbers spamming the webhook
	 * - Business context: Users must be onboarded through proper channels first
	 *
	 * The message is logged with "user_not_found" status for audit purposes.
	 * To enable a user, add their WhatsApp phone number to the users table.
	 */
	if (!user) {
		logWhatsAppEvent("warn", {
			event: "whatsapp.processing.user_not_found",
			direction: "inbound",
			...correlation,
			details: { normalizedFrom },
		});
		throw new Error(`User not found for phone: ${normalizedFrom}`);
	}

	const chatId = await resolveOrCreateChat(user.id, payload);
	const correlationWithChat: WhatsAppCorrelationIds = {
		...correlation,
		chatId,
	};
	const existingMessages = await getChatMessages(chatId);
	const attachments = extractAttachments(payload);

	const inboundMessage = await saveInboundMessage({
		chatId,
		body: payload.Body ?? "",
		attachments,
		messageSid: payload.MessageSid,
		profileName: payload.ProfileName,
		waId: payload.WaId,
		numMedia: payload.NumMedia,
		requestUrl,
	});

	await updateProcessingStatus(payload.MessageSid, "processing", requestUrl);
	await trySendTypingIndicator(client, payload, correlationWithChat);

	const history = convertToUIMessages([...existingMessages, inboundMessage]);

	const aiResponse = await generateSafeAIResponse({
		chatId,
		inboundMessageId: inboundMessage.id,
		history,
		payload,
		requestUrl,
	});

	const normalizedWhatsappFrom = whatsappFrom
		? normalizeWhatsAppNumber(whatsappFrom)
		: null;

	const outboundRecord = await saveOutboundMessage({
		chatId,
		response: aiResponse,
		toNumber: normalizedFrom,
		fromNumber: normalizedWhatsappFrom,
	});

	const sendResult = await trySendWhatsAppMessageWithRetry({
		client,
		to: normalizedFrom,
		from: normalizedWhatsappFrom ?? undefined,
		response: aiResponse,
		correlation: correlationWithChat,
	});

	if (sendResult) {
		await markMessageSent(
			outboundRecord.id,
			outboundRecord.message.metadata as Record<string, unknown>,
			sendResult.sid,
		);
	} else {
		await markMessageFailed(
			outboundRecord.id,
			outboundRecord.message.metadata as Record<string, unknown>,
			"Failed to send WhatsApp message after retries",
		);
	}

	await logWebhookOutbound(
		requestUrl,
		normalizedTo,
		normalizedFrom,
		aiResponse,
		sendResult?.sid,
		sendResult ? sendResult.status : "not_sent",
	);

	return chatId;
}

async function trySendTypingIndicator(
	client: TwilioClient,
	payload: IncomingMessage,
	correlation: WhatsAppCorrelationIds,
): Promise<void> {
	try {
		await sendTypingIndicator(client, payload, correlation);
	} catch (error) {
		const errorMessage =
			error instanceof Error ? error.message : String(error);

		logWhatsAppEvent("error", {
			event: "whatsapp.typing.failed",
			direction: "outbound",
			...correlation,
			error: errorMessage,
		});
		await logTypingFailed(
			payload.MessageSid,
			errorMessage,
		);
	}
}

async function trySendWhatsAppMessageWithRetry(params: {
	client: TwilioClient;
	to: string;
	from?: string;
	response: WhatsAppAIResponse;
	correlation: WhatsAppCorrelationIds;
}): Promise<{ sid: string; status: string } | null> {
	try {
		return await sendWhatsAppMessageWithRetry(params);
	} catch (error) {
		const errorMessage =
			error instanceof Error ? error.message : String(error);

		logWhatsAppEvent("error", {
			event: "whatsapp.outbound.send_failed",
			direction: "outbound",
			...params.correlation,
			toNumber: params.to,
			fromNumber: params.from,
			error: errorMessage,
		});
		await logSendFailed(
			params.from,
			params.to,
			params.response,
			errorMessage,
		);
		return null;
	}
}

interface GenerateSafeAIResponseParams {
	chatId: string;
	inboundMessageId: string;
	history: ReturnType<typeof convertToUIMessages>;
	payload: IncomingMessage;
	requestUrl: string;
}

/**
 * Generate an AI response with safety measures:
 * - Strict timeout (30 seconds)
 * - Response validation
 * - Fallback to canned message on failure
 * - Escalation logging for monitoring
 */
async function generateSafeAIResponse(
	params: GenerateSafeAIResponseParams,
): Promise<WhatsAppAIResponse> {
	const { chatId, inboundMessageId, history, payload, requestUrl } = params;
	const model = myProvider.languageModel("chat-model");
	const span = tracer.startSpan("llm.generate_whatsapp_response");

	setWhatsAppSpanAttributes(span, {
		event: "whatsapp.llm.generate",
		direction: "internal",
		messageSid: payload.MessageSid,
		waId: payload.WaId,
		chatId,
		requestUrl,
	});

	span.setAttribute("llm.operation", "generateObject");
	if (model.modelId) {
		span.setAttribute("llm.model_id", model.modelId);
	}

	try {
		const { object: aiResponse } = await generateObject({
			model,
			system: buildSystemPrompt(payload),
			messages: await convertToModelMessages(history),
			schema: whatsappResponseSchema,
			maxRetries: LLM_CONFIG.maxRetries,
			abortSignal: AbortSignal.timeout(LLM_CONFIG.timeoutMs),
			experimental_telemetry: {
				isEnabled: true,
				functionId: "generate-whatsapp-response",
			},
		});

		// Validate the response
		if (!isValidWhatsAppResponse(aiResponse)) {
			span.setStatus({
				code: SpanStatusCode.ERROR,
				message: "invalid_response",
			});

			logWhatsAppEvent("warn", {
				event: "whatsapp.llm.invalid_response",
				direction: "internal",
				messageSid: payload.MessageSid,
				waId: payload.WaId,
				chatId,
				details: {
					messageLength: aiResponse.message?.length ?? 0,
				},
			});

			await logAIEscalation({
				chatId,
				messageId: inboundMessageId,
				failureType: aiResponse.message ? "invalid_response" : "empty_response",
				error: "AI response failed validation",
				requestUrl,
			});

			return FALLBACK_RESPONSE;
		}

		span.setStatus({ code: SpanStatusCode.OK });
		return aiResponse;
	} catch (error) {
		const failureType = classifyAIError(error);
		const errorMessage = getSafeErrorMessage(error);

		span.recordException(error as Error);
		span.setStatus({ code: SpanStatusCode.ERROR, message: errorMessage });

		logWhatsAppEvent("error", {
			event: "whatsapp.llm.failed",
			direction: "internal",
			messageSid: payload.MessageSid,
			waId: payload.WaId,
			chatId,
			error: errorMessage,
			details: { failureType },
		});

		await logAIEscalation({
			chatId,
			messageId: inboundMessageId,
			failureType,
			error: errorMessage,
			requestUrl,
		});

		return FALLBACK_RESPONSE;
	} finally {
		span.end();
	}
}
