import { trace } from "@opentelemetry/api";
import { convertToModelMessages, generateObject } from "ai";
import { myProvider } from "@/lib/ai/providers";
import { convertToUIMessages } from "@/lib/utils";
import {
	findUserByPhone,
	getChatMessages,
	logProcessingError,
	logSendFailed,
	logTypingFailed,
	logWebhookOutbound,
	logWebhookReceived,
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
	sendWhatsAppMessage,
	type TwilioClient,
} from "./twilio";
import { type IncomingMessage, whatsappResponseSchema } from "./types";
import {
	buildSystemPrompt,
	extractAttachments,
	normalizeWhatsAppNumber,
} from "./utils";

const tracer = trace.getTracer("whatsapp-webhook");

export async function processWhatsAppMessage({
	payload,
	requestUrl,
}: {
	payload: IncomingMessage;
	requestUrl: string;
}) {
	return tracer.startActiveSpan("process-whatsapp", async (span) => {
		try {
			await updateProcessingStatus(payload.MessageSid, "processing", requestUrl);
			await handleWhatsAppMessage({ payload, requestUrl });
			await updateProcessingStatus(payload.MessageSid, "processed");
		} catch (error) {
			console.error("[whatsapp:webhook] processing failed", error);
			const errorMessage =
				error instanceof Error ? error.message : String(error);

			const updated = await updateProcessingStatus(
				payload.MessageSid,
				"processing_error",
				undefined,
				errorMessage,
			);

			if (!updated) {
				await logProcessingError(
					payload.MessageSid,
					payload.From,
					payload.To,
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
}) {
	console.log("[whatsapp:after] processing message", {
		from: payload.From,
		to: payload.To,
		messageSid: payload.MessageSid,
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

	if (!user) {
		throw new Error("Failed to get user for WhatsApp contact");
	}

	const chatId = await resolveOrCreateChat(user.id, payload);
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

	await logWebhookReceived(requestUrl, payload);
	await trySendTypingIndicator(client, payload);

	const history = convertToUIMessages([...existingMessages, inboundMessage]);

	const { object: aiResponse } = await generateObject({
		model: myProvider.languageModel("chat-model"),
		system: buildSystemPrompt(payload),
		messages: convertToModelMessages(history),
		schema: whatsappResponseSchema,
		maxRetries: 2,
		abortSignal: AbortSignal.timeout(100_000),
		experimental_telemetry: {
			isEnabled: true,
			functionId: "generate-whatsapp-response",
		},
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

	const sendResult = await trySendWhatsAppMessage({
		client,
		to: normalizedFrom,
		from: normalizedWhatsappFrom ?? undefined,
		response: aiResponse,
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
			"Failed to send WhatsApp message",
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
}

async function trySendTypingIndicator(
	client: TwilioClient,
	payload: IncomingMessage,
): Promise<void> {
	try {
		await sendTypingIndicator(client, payload);
	} catch (error) {
		console.error("[whatsapp:typing] failed to send indicator", error);
		await logTypingFailed(
			payload.MessageSid,
			error instanceof Error ? error.message : String(error),
		);
	}
}

async function trySendWhatsAppMessage(params: {
	client: TwilioClient;
	to: string;
	from?: string;
	response: Parameters<typeof sendWhatsAppMessage>[0]["response"];
}): Promise<{ sid: string; status: string } | null> {
	try {
		return await sendWhatsAppMessage(params);
	} catch (error) {
		console.error("[whatsapp:send] failed to dispatch message", error);
		await logSendFailed(
			params.from,
			params.to,
			params.response,
			error instanceof Error ? error.message : String(error),
		);
		return null;
	}
}
