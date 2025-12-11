import { generateObject, convertToModelMessages } from "ai";
import { after } from "next/server";
import twilio from "twilio";
import { z } from "zod";
import { trace } from "@opentelemetry/api";
import { myProvider } from "@/lib/ai/providers";
import { svrnHostSystemPrompt } from "@/lib/ai/prompts";
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
import type { Attachment } from "@/lib/types";
import { generateUUID } from "@/lib/utils";

const sourceLabel = "twilio:whatsapp";

const incomingMessageSchema = z
	.object({
		MessageSid: z.string(),
		From: z.string(),
		To: z.string(),
		Body: z.string().optional().default(""),
		ProfileName: z.string().optional(),
		WaId: z.string().optional(),
		NumMedia: z.coerce.number().optional().default(0),
	})
	.passthrough();

const whatsappResponseSchema = z.object({
	message: z.string(),
	buttons: z
		.array(
			z.object({
				id: z.string().optional(),
				label: z.string(),
				url: z.string().url().optional(),
			}),
		)
		.optional(),
	mediaUrl: z.string().url().optional(),
	location: z
		.object({
			name: z.string(),
			latitude: z.number(),
			longitude: z.number(),
			label: z.string().optional(),
		})
		.optional(),
});

type IncomingMessage = z.infer<typeof incomingMessageSchema>;
type WhatsAppAIResponse = z.infer<typeof whatsappResponseSchema>;

const tracer = trace.getTracer("whatsapp-webhook");

export async function POST(request: Request) {
	const rawBody = await request.text();
	console.log("[whatsapp:webhook] received payload", {
		contentLength: rawBody.length,
		url: request.url,
	});

	if (!rawBody) {
		return new Response("Missing payload", { status: 400 });
	}

	const rawParams = Object.fromEntries(new URLSearchParams(rawBody));
	const parsedPayload = incomingMessageSchema.safeParse(rawParams);

	if (!parsedPayload.success) {
		console.warn("[whatsapp:webhook] payload failed validation", {
			issues: parsedPayload.error.issues,
		});

		after(() =>
			saveWebhookLog({
				source: sourceLabel,
				status: "invalid_payload",
				requestUrl: request.url,
				payload: { issues: parsedPayload.error.format() },
			}),
		);

		return new Response("Invalid payload", { status: 400 });
	}

	const payload = parsedPayload.data;
	const signature = request.headers.get("x-twilio-signature");
	const authToken = process.env.TWILIO_AUTH_TOKEN;
	const webhookUrl =
		process.env.TWILIO_WHATSAPP_WEBHOOK_URL?.trim() || request.url;

	if (!signature) {
		console.warn("[whatsapp:webhook] missing signature header");
		after(() =>
			saveWebhookLog({
				source: sourceLabel,
				status: "missing_signature",
				requestUrl: webhookUrl,
				payload,
			}),
		);
		return new Response("Forbidden", { status: 403 });
	}

	if (!authToken) {
		console.error("[whatsapp:webhook] missing TWILIO_AUTH_TOKEN");
		return new Response("Server misconfigured", { status: 500 });
	}

	const isValidRequest = twilio.validateRequest(
		authToken,
		signature,
		webhookUrl,
		rawParams,
	);

	if (!isValidRequest) {
		console.warn("[whatsapp:webhook] signature validation failed", {
			webhookUrl,
			messageSid: payload.MessageSid,
		});
		after(() =>
			saveWebhookLog({
				source: sourceLabel,
				status: "signature_failed",
				requestUrl: webhookUrl,
				messageSid: payload.MessageSid,
				fromNumber: payload.From,
				toNumber: payload.To,
				payload,
			}),
		);
		return new Response("Forbidden", { status: 403 });
	}

	console.log("[whatsapp:webhook] signature validated", {
		messageSid: payload.MessageSid,
	});

	after(() =>
		tracer.startActiveSpan("process-whatsapp", async (span) => {
			try {
				await handleWhatsAppMessage({
					payload,
					requestUrl: webhookUrl,
				});
			} catch (error) {
				console.error("[whatsapp:webhook] processing failed", error);
				await saveWebhookLog({
					source: sourceLabel,
					status: "processing_error",
					requestUrl: webhookUrl,
					messageSid: payload.MessageSid,
					fromNumber: payload.From,
					toNumber: payload.To,
					error: error instanceof Error ? error.message : String(error),
				});
			} finally {
				span.end();
			}
		}),
	);

	return new Response("<Response></Response>", {
		status: 200,
		headers: { "Content-Type": "text/xml" },
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

	const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
	const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
	const whatsappFrom = process.env.TWILIO_WHATSAPP_FROM;

	if (!twilioAccountSid || !twilioAuthToken) {
		throw new Error("Twilio credentials are not configured");
	}

	if (!whatsappFrom && !process.env.TWILIO_MESSAGING_SERVICE_SID) {
		throw new Error(
			"TWILIO_WHATSAPP_FROM or TWILIO_MESSAGING_SERVICE_SID is required",
		);
	}

	const client = twilio(twilioAccountSid, twilioAuthToken, {
		autoRetry: true,
		maxRetries: 3,
	});

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

	const history = [
		...existingMessages,
		inboundMessage,
	].map((message) => ({
		id: message.id,
		role: message.role,
		parts: message.parts,
		metadata: { createdAt: message.createdAt.toISOString() },
	}));

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

function normalizeWhatsAppNumber(value: string) {
	if (value.startsWith("whatsapp:")) {
		return value;
	}
	return `whatsapp:${value}`;
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

function extractAttachments(payload: IncomingMessage): Attachment[] {
	const attachmentCount = payload.NumMedia ?? 0;
	const attachments: Attachment[] = [];

	for (let index = 0; index < attachmentCount; index += 1) {
		const mediaUrl =
			payload[`MediaUrl${index}` as keyof typeof payload] as unknown as
				| string
				| undefined;
		const contentType =
			payload[`MediaContentType${index}` as keyof typeof payload] as unknown as
				| string
				| undefined;

		if (mediaUrl) {
			attachments.push({
				name: `media-${index + 1}`,
				url: mediaUrl,
				contentType: contentType ?? "application/octet-stream",
			});
		}
	}

	return attachments;
}

function buildSystemPrompt(payload: IncomingMessage) {
	return `${svrnHostSystemPrompt}

You are chatting with a WhatsApp user. Keep replies concise, single-message friendly, and formatted for WhatsApp. Always return a JSON object that matches the provided schema with a "message" string and optional buttons (short quick replies), optional mediaUrl, and optional location data. Do not include Markdown fences or additional prose.

Caller:
- Profile: ${payload.ProfileName ?? "unknown"}
- Phone: ${payload.From}`;
}

async function sendTypingIndicator(client: twilio.Twilio, payload: IncomingMessage) {
	const conversationSid =
		payload["ConversationSid" as keyof IncomingMessage] as unknown as
			| string
			| undefined;
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
		const [agentParticipant] = await client.conversations.v1
			.conversations(conversationSid)
			.participants.list({ identity: agentIdentity, limit: 1 });

		if (!agentParticipant) {
			console.log("[whatsapp:typing] agent participant not found", {
				conversationSid,
				agentIdentity,
			});
			return;
		}

		await client.conversations.v1
			.conversations(conversationSid)
			.participants(agentParticipant.sid)
			.typing();

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

	const payload: Record<string, unknown> = {
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
