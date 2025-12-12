import { trace } from "@opentelemetry/api";
import { convertToModelMessages, generateObject } from "ai";
import twilio from "twilio";
import type { MessageListInstanceCreateOptions } from "twilio/lib/rest/api/v2010/account/message";
import { myProvider } from "@/lib/ai/providers";
import {
	getLatestChatForUser,
	getMessagesByChatId,
	getUserByPhone,
	saveChat,
	saveMessages,
	saveWebhookLog,
	upsertWebhookLogByMessageSid,
	updateMessageMetadata,
} from "@/lib/db/queries";
import type { DBMessage } from "@/lib/db/schema";
import { convertToUIMessages, generateUUID } from "@/lib/utils";
import {
	type IncomingMessage,
	sourceLabel,
	type WhatsAppAIResponse,
	whatsappResponseSchema,
} from "./types";
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
			await upsertWebhookLogByMessageSid({
				source: sourceLabel,
				messageSid: payload.MessageSid,
				status: "processing",
				requestUrl,
			});
			await handleWhatsAppMessage({ payload, requestUrl });
			await upsertWebhookLogByMessageSid({
				source: sourceLabel,
				messageSid: payload.MessageSid,
				status: "processed",
				error: null,
			});
		} catch (error) {
			console.error("[whatsapp:webhook] processing failed", error);
			const errorMessage =
				error instanceof Error ? error.message : String(error);

			const updated = await upsertWebhookLogByMessageSid({
				source: sourceLabel,
				messageSid: payload.MessageSid,
				status: "processing_error",
				error: errorMessage,
			});

			if (!updated) {
				await saveWebhookLog({
					source: sourceLabel,
					status: "processing_error",
					requestUrl,
					messageSid: payload.MessageSid,
					fromNumber: payload.From,
					toNumber: payload.To,
					error: errorMessage,
				});
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

	const user = await getUserByPhone(normalizedFrom);

	if (!user) {
		throw new Error("Failed to get user for WhatsApp contact");
	}

	const chatId = await resolveChatId({
		userId: user.id,
		payload,
	});

	const existingMessages = await getMessagesByChatId({ id: chatId });
	const attachments = extractAttachments(payload);

	const inboundMessageId = generateUUID();
	const inboundMessage: DBMessage = {
		id: inboundMessageId,
		chatId,
		role: "user",
		parts: [{ type: "text", text: payload.Body ?? "" }],
		attachments,
		metadata: {
			source: sourceLabel,
			direction: "inbound",
			messageSid: payload.MessageSid,
			profileName: payload.ProfileName,
			waId: payload.WaId,
			numMedia: payload.NumMedia,
			requestUrl,
		},
		createdAt: new Date(),
	};

	await saveMessages({ messages: [inboundMessage] });
	await upsertWebhookLogByMessageSid({
		source: sourceLabel,
		direction: "inbound",
		status: "received",
		requestUrl,
		messageSid: payload.MessageSid,
		fromNumber: payload.From,
		toNumber: payload.To,
		payload,
	});

	await sendTypingIndicator(client, payload);

	const history = convertToUIMessages([...existingMessages, inboundMessage]);

	const { object: aiResponse } = await generateObject({
		model: myProvider.languageModel("chat-model"),
		system: buildSystemPrompt(payload),
		messages: convertToModelMessages(history),
		schema: whatsappResponseSchema,
		maxRetries: 2,
		abortSignal: AbortSignal.timeout(100_000), // 100 second timeout
		experimental_telemetry: {
			isEnabled: true,
			functionId: "generate-whatsapp-response",
		},
	});

	// Create assistant message with pending status before attempting to send
	const assistantMessageId = generateUUID();
	const assistantMessage: DBMessage = {
		id: assistantMessageId,
		chatId,
		role: "assistant",
		parts: [{ type: "text", text: aiResponse.message }],
		attachments: [],
		metadata: {
			source: sourceLabel,
			direction: "outbound",
			sendStatus: "pending" as const,
			toNumber: normalizedFrom,
			fromNumber: whatsappFrom ? normalizeWhatsAppNumber(whatsappFrom) : null,
			buttons: aiResponse.buttons,
			location: aiResponse.location,
			mediaUrl: aiResponse.mediaUrl,
		},
		createdAt: new Date(),
	};

	// Save message with pending status first so we can retry if send fails
	await saveMessages({ messages: [assistantMessage] });

	const sendResult = await sendWhatsAppResponse({
		client,
		to: normalizedFrom,
		from: whatsappFrom ? normalizeWhatsAppNumber(whatsappFrom) : undefined,
		response: aiResponse,
	});

	// Update message metadata with send result
	await updateMessageMetadata({
		id: assistantMessageId,
		metadata: {
			...assistantMessage.metadata,
			sendStatus: sendResult ? ("sent" as const) : ("failed" as const),
			messageSid: sendResult?.sid ?? null,
			sendError: sendResult ? null : "Failed to send WhatsApp message",
			sentAt: sendResult ? new Date().toISOString() : null,
		},
	});

	await saveWebhookLog({
		source: sourceLabel,
		direction: "outbound",
		status: sendResult ? sendResult.status : "not_sent",
		requestUrl,
		messageSid: sendResult?.sid,
		fromNumber: normalizedTo,
		toNumber: normalizedFrom,
		payload: aiResponse,
	});
}

function createTwilioClient() {
	const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
	const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;

	if (!twilioAccountSid || !twilioAuthToken) {
		throw new Error("Twilio credentials are not configured");
	}

	return twilio(twilioAccountSid, twilioAuthToken, {
		autoRetry: true,
		maxRetries: 3,
	});
}

async function resolveChatId({
	userId,
	payload,
}: {
	userId: string;
	payload: IncomingMessage;
}) {
	const existingChat = await getLatestChatForUser({ userId });

	if (existingChat) {
		return existingChat.id;
	}

	const chatId = generateUUID();

	await saveChat({
		id: chatId,
		userId,
		title: `WhatsApp ${payload.ProfileName ?? payload.From}`,
	});

	return chatId;
}

async function sendTypingIndicator(
	client: twilio.Twilio,
	payload: IncomingMessage,
) {
	const conversationSid = payload.ConversationSid;
	const agentIdentity = process.env.TWILIO_CONVERSATIONS_AGENT_IDENTITY;

	if (!conversationSid || !agentIdentity) {
		console.log(
			"[whatsapp:typing] skipping typing indicator",
			!conversationSid
				? "missing conversationSid"
				: "missing agent identity env",
		);
		return;
	}

	try {
		const participants = await client.conversations.v1
			.conversations(conversationSid)
			.participants.list();

		const agentParticipant = participants.find(
			(participant) => participant.identity === agentIdentity,
		);

		if (!agentParticipant) {
			console.log("[whatsapp:typing] agent participant not found", {
				conversationSid,
				agentIdentity,
			});
			return;
		}

		await client.request({
			method: "post",
			uri: `https://conversations.twilio.com/v1/Conversations/${conversationSid}/Participants/${agentParticipant.sid}/Typing`,
		});

		console.log("[whatsapp:typing] indicator sent", { conversationSid });
	} catch (error) {
		console.error("[whatsapp:typing] failed to send indicator", error);
		const errorMessage =
			error instanceof Error ? error.message : String(error);

		const updated = await upsertWebhookLogByMessageSid({
			source: sourceLabel,
			messageSid: payload.MessageSid,
			status: "typing_failed",
			error: errorMessage,
		});

		if (!updated) {
			await saveWebhookLog({
				source: sourceLabel,
				status: "typing_failed",
				payload: {
					messageSid: payload.MessageSid,
					error: errorMessage,
				},
			});
		}
	}
}

async function sendWhatsAppResponse({
	client,
	to,
	from,
	response,
}: {
	client: twilio.Twilio;
	to: string;
	from?: string;
	response: WhatsAppAIResponse;
}) {
	const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
	const buttonsContentSid = process.env.TWILIO_WHATSAPP_BUTTONS_CONTENT_SID;

	const payload: MessageListInstanceCreateOptions = {
		to,
	};

	if (messagingServiceSid) {
		payload.messagingServiceSid = messagingServiceSid;
	} else if (from) {
		payload.from = from;
	}

	if (response.mediaUrl) {
		payload.mediaUrl = [response.mediaUrl];
	}

	if (response.location) {
		payload.persistentAction = [
			`geo:${response.location.latitude},${response.location.longitude}|${response.location.label ?? response.location.name}`,
		];
	}

	if (response.buttons?.length && buttonsContentSid) {
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
			console.warn(
				"[whatsapp:send] AI response included buttons, but TWILIO_WHATSAPP_BUTTONS_CONTENT_SID is not configured. Buttons will be ignored.",
			);
		}
		payload.body = response.message;
	}

	try {
		const result = await client.messages.create(payload);
		console.log("[whatsapp:send] message dispatched", {
			sid: result.sid,
			status: result.status,
		});
		return result;
	} catch (error) {
		console.error("[whatsapp:send] failed to dispatch message", error, payload);
		await saveWebhookLog({
			source: sourceLabel,
			direction: "outbound",
			status: "send_failed",
			fromNumber: from,
			toNumber: to,
			error: error instanceof Error ? error.message : String(error),
			payload: response,
		});
		return null;
	}
}
