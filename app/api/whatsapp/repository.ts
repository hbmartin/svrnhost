import {
	createPendingWebhookLog,
	getLatestChatForUser,
	getMessagesByChatId,
	getUserByPhone,
	saveChat,
	saveMessages,
	saveWebhookLog,
	updateMessageMetadata,
	upsertWebhookLogByMessageSid,
} from "@/lib/db/queries";
import type { DBMessage, User } from "@/lib/db/schema";
import type { Attachment } from "@/lib/types";
import { generateUUID } from "@/lib/utils";
import type { IncomingMessage, WhatsAppAIResponse } from "./types";
import { sourceLabel } from "./types";

export interface CreateInboundMessageParams {
	chatId: string;
	body: string;
	attachments: Attachment[];
	messageSid: string;
	profileName?: string;
	waId?: string;
	numMedia?: number;
	requestUrl: string;
}

export interface CreateOutboundMessageParams {
	chatId: string;
	response: WhatsAppAIResponse;
	toNumber: string;
	fromNumber: string | null;
}

export interface OutboundMessageRecord {
	id: string;
	message: DBMessage;
}

export async function findUserByPhone(phone: string): Promise<User | null> {
	return getUserByPhone(phone);
}

export async function resolveOrCreateChat(
	userId: string,
	payload: IncomingMessage,
): Promise<string> {
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

export async function getChatMessages(chatId: string): Promise<DBMessage[]> {
	return getMessagesByChatId({ id: chatId });
}

export async function saveInboundMessage(
	params: CreateInboundMessageParams,
): Promise<DBMessage> {
	const messageId = generateUUID();
	const message: DBMessage = {
		id: messageId,
		chatId: params.chatId,
		role: "user",
		parts: [{ type: "text", text: params.body }],
		attachments: params.attachments,
		metadata: {
			source: sourceLabel,
			direction: "inbound",
			messageSid: params.messageSid,
			profileName: params.profileName,
			waId: params.waId,
			numMedia: params.numMedia,
			requestUrl: params.requestUrl,
		},
		createdAt: new Date(),
	};

	await saveMessages({ messages: [message] });
	return message;
}

export async function saveOutboundMessage(
	params: CreateOutboundMessageParams,
): Promise<OutboundMessageRecord> {
	const messageId = generateUUID();
	const message: DBMessage = {
		id: messageId,
		chatId: params.chatId,
		role: "assistant",
		parts: [{ type: "text", text: params.response.message }],
		attachments: [],
		metadata: {
			source: sourceLabel,
			direction: "outbound",
			sendStatus: "pending" as const,
			toNumber: params.toNumber,
			fromNumber: params.fromNumber,
			buttons: params.response.buttons,
			location: params.response.location,
			mediaUrl: params.response.mediaUrl,
		},
		createdAt: new Date(),
	};

	await saveMessages({ messages: [message] });
	return { id: messageId, message };
}

export async function markMessageSent(
	messageId: string,
	currentMetadata: Record<string, unknown>,
	messageSid: string,
): Promise<void> {
	await updateMessageMetadata({
		id: messageId,
		metadata: {
			...currentMetadata,
			sendStatus: "sent" as const,
			messageSid,
			sendError: null,
			sentAt: new Date().toISOString(),
		},
	});
}

export async function markMessageFailed(
	messageId: string,
	currentMetadata: Record<string, unknown>,
	error: string,
): Promise<void> {
	await updateMessageMetadata({
		id: messageId,
		metadata: {
			...currentMetadata,
			sendStatus: "failed" as const,
			messageSid: null,
			sendError: error,
			sentAt: null,
		},
	});
}

export async function logWebhookOutbound(
	requestUrl: string,
	fromNumber: string,
	toNumber: string,
	response: WhatsAppAIResponse,
	messageSid?: string,
	status?: string,
): Promise<void> {
	await saveWebhookLog({
		source: sourceLabel,
		direction: "outbound",
		status: status ?? "sent",
		requestUrl,
		messageSid,
		fromNumber,
		toNumber,
		payload: response,
	});
}

export async function logWebhookError(
	status: string,
	messageSid?: string,
	error?: string,
	payload?: Record<string, unknown>,
): Promise<void> {
	await saveWebhookLog({
		source: sourceLabel,
		status,
		messageSid,
		error,
		payload,
	});
}

export async function logTypingFailed(
	messageSid: string,
	error: string,
): Promise<void> {
	await saveWebhookLog({
		source: sourceLabel,
		status: "typing_failed",
		messageSid,
		error,
	});
}

export async function logSendFailed(
	from: string | undefined,
	to: string,
	response: WhatsAppAIResponse,
	error: string,
): Promise<void> {
	await saveWebhookLog({
		source: sourceLabel,
		direction: "outbound",
		status: "send_failed",
		fromNumber: from,
		toNumber: to,
		error,
		payload: response,
	});
}

export async function createPendingLog(
	requestUrl: string,
	payload: IncomingMessage,
) {
	return createPendingWebhookLog({
		source: sourceLabel,
		requestUrl,
		messageSid: payload.MessageSid,
		fromNumber: payload.From,
		toNumber: payload.To,
		payload,
	});
}

export async function updateProcessingStatus(
	messageSid: string,
	status: "processing" | "processed" | "processing_error",
	requestUrl?: string,
	error?: string | null,
): Promise<boolean> {
	const result = await upsertWebhookLogByMessageSid({
		source: sourceLabel,
		messageSid,
		status,
		requestUrl,
		error: error ?? null,
	});
	return result !== null;
}

export async function logProcessingError(
	messageSid: string,
	fromNumber: string,
	toNumber: string,
	requestUrl: string,
	error: string,
): Promise<void> {
	await saveWebhookLog({
		source: sourceLabel,
		status: "processing_error",
		requestUrl,
		messageSid,
		fromNumber,
		toNumber,
		error,
	});
}
