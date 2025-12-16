import twilio, { RestException } from "twilio";
import type { MessageListInstanceCreateOptions } from "twilio/lib/rest/api/v2010/account/message";
import type { IncomingMessage, WhatsAppAIResponse } from "./types";

export type TwilioClient = twilio.Twilio;

export function createTwilioClient(): TwilioClient {
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

export function validateTwilioRequest(
	signature: string,
	url: string,
	params: Record<string, string>,
): boolean {
	const authToken = process.env.TWILIO_AUTH_TOKEN;
	if (!authToken) {
		return false;
	}
	return twilio.validateRequest(authToken, signature, url, params);
}

export async function sendTypingIndicator(
	client: TwilioClient,
	payload: IncomingMessage,
): Promise<void> {
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
}

export interface SendMessageParams {
	client: TwilioClient;
	to: string;
	from?: string;
	response: WhatsAppAIResponse;
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
}: SendMessageParams): Promise<SendMessageResult> {
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

	const result = await client.messages.create(payload);
	console.log("[whatsapp:send] message dispatched", {
		sid: result.sid,
		status: result.status,
	});

	return {
		sid: result.sid,
		status: result.status,
	};
}
