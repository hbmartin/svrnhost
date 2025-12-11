import { trace } from "@opentelemetry/api";
import { convertToModelMessages, generateObject } from "ai";
import twilio from "twilio";
import type { MessageListInstanceCreateOptions } from "twilio/lib/rest/api/v2010/account/message";
import { myProvider } from "@/lib/ai/providers";
import {
	createUser,
	getLatestChatForUser,
	getMessagesByChatId,
	getUser,
	saveChat,
	saveMessages,
	saveWebhookLog,
} from "@/lib/db/queries";
import type { DBMessage } from "@/lib/db/schema";
import { convertToUIMessages, generateUUID } from "@/lib/utils";
import {
	sourceLabel,
	type IncomingMessage,
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
			await handleWhatsAppMessage({ payload, requestUrl });
		} catch (error) {
			console.error("[whatsapp:webhook] processing failed", error);
			await saveWebhookLog({
				source: sourceLabel,
				status: "processing_error",
				requestUrl,
				messageSid: payload.MessageSid,
				fromNumber: payload.From,
				toNumber: payload.To,
				error: error instanceof Error ? error.message : String(error),
			});
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

	const user = await resolveUser(normalizedFrom);
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
	await saveWebhookLog({
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
	});

	const sendResult = await sendWhatsAppResponse({
		client,
		to: normalizedFrom,
		from: whatsappFrom ? normalizeWhatsAppNumber(whatsappFrom) : undefined,
		response: aiResponse,
	});

	const assistantMessage: DBMessage = {
		id: generateUUID(),
		chatId,
		role: "assistant",
		parts: [{ type: "text", text: aiResponse.message }],
		attachments: [],
		metadata: {
			source: sourceLabel,
			direction: "outbound",
			messageSid: sendResult?.sid ?? null,
			buttons: aiResponse.buttons,
			location: aiResponse.location,
			mediaUrl: aiResponse.mediaUrl,
		},
		createdAt: new Date(),
	};

	await saveMessages({ messages: [assistantMessage] });

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

async function resolveUser(phoneAsEmail: string) {
	const [existingUser] = await getUser(phoneAsEmail);

	if (existingUser) {
		return existingUser;
	}

	const [newUser] = await createUser(phoneAsEmail, generateUUID());

	if (!newUser) {
		throw new Error("Failed to create user for WhatsApp contact");
	}

	return newUser;
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
	const conversationSid = payload[
		"ConversationSid" as keyof IncomingMessage
	] as unknown as string | undefined;
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
		await saveWebhookLog({
			source: sourceLabel,
			status: "typing_failed",
			messageSid: payload.MessageSid,
			error: error instanceof Error ? error.message : String(error),
		});
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
