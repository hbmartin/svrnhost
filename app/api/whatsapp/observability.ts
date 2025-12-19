import type { Span } from "@opentelemetry/api";

export type WhatsAppLogLevel = "info" | "warn" | "error";
export type WhatsAppDirection = "inbound" | "outbound" | "internal";

export interface WhatsAppCorrelationIds {
	messageSid?: string;
	waId?: string;
	chatId?: string;
}

export interface WhatsAppLogFields extends WhatsAppCorrelationIds {
	event: string;
	direction?: WhatsAppDirection;
	status?: string;
	requestUrl?: string;
	fromNumber?: string;
	toNumber?: string;
	error?: string;
	details?: Record<string, unknown>;
}

export function logWhatsAppEvent(
	level: WhatsAppLogLevel,
	fields: WhatsAppLogFields,
): void {
	const logger =
		level === "error" ? console.error : level === "warn" ? console.warn : console.log;

	try {
		logger("[whatsapp]", {
			service: "whatsapp",
			nodeEnv: process.env.NODE_ENV,
			vercelEnv: process.env.VERCEL_ENV,
			...fields,
		});
	} catch {
		// Logging must never break the handler
	}
}

export function setWhatsAppSpanAttributes(
	span: Span,
	fields: Partial<WhatsAppLogFields>,
): void {
	if (fields.event) {
		span.setAttribute("whatsapp.event", fields.event);
	}
	if (fields.direction) {
		span.setAttribute("whatsapp.direction", fields.direction);
	}
	if (fields.messageSid) {
		span.setAttribute("whatsapp.message_sid", fields.messageSid);
	}
	if (fields.waId) {
		span.setAttribute("whatsapp.wa_id", fields.waId);
	}
	if (fields.chatId) {
		span.setAttribute("whatsapp.chat_id", fields.chatId);
	}
	if (fields.requestUrl) {
		span.setAttribute("whatsapp.request_url", fields.requestUrl);
	}
	if (fields.fromNumber) {
		span.setAttribute("whatsapp.from_number", fields.fromNumber);
	}
	if (fields.toNumber) {
		span.setAttribute("whatsapp.to_number", fields.toNumber);
	}
	if (fields.status) {
		span.setAttribute("whatsapp.status", fields.status);
	}
}
