/** biome-ignore-all lint/suspicious/useAwait: tracing */
import { SpanStatusCode, trace } from "@opentelemetry/api";
import { convertToModelMessages, generateText } from "ai";
import { myProvider } from "@/lib/ai/providers";
import {
	classifyAIError,
	FALLBACK_RESPONSE,
	getFailureResponse,
	getSafeErrorMessage,
	isValidWhatsAppResponse,
	LLM_CONFIG,
} from "@/lib/ai/safety";
import type { convertToUIMessages } from "@/lib/utils";
import { logWhatsAppEvent, setWhatsAppSpanAttributes } from "./observability";
import { logAIEscalation } from "./repository";
import type { IncomingMessage } from "./types";
import { buildSystemPrompt } from "./utils";

const tracer = trace.getTracer("whatsapp-ai-response");

export interface GenerateSafeAIResponseParams {
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
export async function generateSafeAIResponse(
	params: GenerateSafeAIResponseParams,
): Promise<string> {
	const { chatId, inboundMessageId, history, payload, requestUrl } = params;
	const model = myProvider.languageModel("chat-model");

	return tracer.startActiveSpan(
		"llm.generate_whatsapp_response",
		async (span) => {
			setWhatsAppSpanAttributes(span, {
				event: "whatsapp.llm.generate",
				direction: "internal",
				messageSid: payload.MessageSid,
				waId: payload.WaId,
				chatId,
				requestUrl,
			});

			span.setAttribute("llm.operation", "generateText");
			if (model.modelId) {
				span.setAttribute("llm.model_id", model.modelId);
			}

			try {
				const aiGeneratedFullResponse = await generateText({
					model,
					system: buildSystemPrompt(payload),
					messages: await convertToModelMessages(history),
					maxRetries: LLM_CONFIG.maxRetries,
					abortSignal: AbortSignal.timeout(LLM_CONFIG.timeoutMs),
					experimental_telemetry: {
						isEnabled: true,
						functionId: "generate-whatsapp-response",
					},
				});

				logWhatsAppEvent("info", {
					event: "whatsapp.processing.response_generated",
					chatId,
					requestUrl,
					details: {
						text: aiGeneratedFullResponse.text,
						finishReason: aiGeneratedFullResponse.finishReason,
						usage: aiGeneratedFullResponse.usage,
					},
				});
				const aiResponse = aiGeneratedFullResponse.text;

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
							messageLength: aiResponse?.length ?? 0,
						},
					});

					await logAIEscalation({
						chatId,
						messageId: inboundMessageId,
						failureType: aiResponse ? "invalid_response" : "empty_response",
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
				return getFailureResponse(failureType);
			} finally {
				span.end();
			}
		},
	);
}
