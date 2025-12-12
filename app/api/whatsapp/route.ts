import { after } from "next/server";
import twilio from "twilio";
import {
	sourceLabel,
	incomingMessageSchema,
} from "./types";
import { processWhatsAppMessage } from "./service";
import { getWebhookLogByMessageSid, saveWebhookLog } from "@/lib/db/queries";

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
	const webhookUrl = process.env.TWILIO_WHATSAPP_WEBHOOK_URL?.trim();

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

	if (!webhookUrl) {
		console.error("[whatsapp:webhook] missing TWILIO_WHATSAPP_WEBHOOK_URL");
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

	const existingLog = await getWebhookLogByMessageSid({
		messageSid: payload.MessageSid,
	});

	if (existingLog) {
		console.log("[whatsapp:webhook] duplicate detected, skipping", {
			messageSid: payload.MessageSid,
		});

		return new Response("<Response></Response>", {
			status: 200,
			headers: { "Content-Type": "text/xml" },
		});
	}

	after(() =>
		processWhatsAppMessage({
			payload,
			requestUrl: webhookUrl,
		}),
	);

	return new Response("<Response></Response>", {
		status: 200,
		headers: { "Content-Type": "text/xml" },
	});
}
