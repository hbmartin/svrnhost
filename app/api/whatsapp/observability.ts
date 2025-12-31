import type { Span } from "@opentelemetry/api";
import type { Scope as SentryScope } from "@sentry/nextjs";
import * as Sentry from "@sentry/nextjs";
import { vercelEnv } from "@/lib/config/server";

export type WhatsAppLogLevel = "info" | "warn" | "error";

export type WhatsAppDirection = "inbound" | "outbound" | "internal";

export interface WhatsAppCorrelationIds {
	messageSid?: string | undefined;
	waId?: string | undefined;
	chatId?: string | undefined;
}

export interface WhatsAppLogFields extends WhatsAppCorrelationIds {
	event: string;
	direction?: WhatsAppDirection | undefined;
	status?: string | undefined;
	requestUrl?: string | undefined;
	fromNumber?: string | undefined;
	toNumber?: string | undefined;
	error?: string | undefined;
	exception?: unknown;
	details?: Record<string, unknown> | undefined;
}

const tagMappings: Partial<Record<keyof WhatsAppLogFields, string>> = {
	direction: "whatsapp.direction",
	status: "whatsapp.status",
	messageSid: "whatsapp.message_sid",
	waId: "whatsapp.wa_id",
	chatId: "whatsapp.chat_id",
};

function setSentryScopeTags(
	scope: SentryScope,
	fields: WhatsAppLogFields,
): void {
	scope.setTag("service", "whatsapp");
	scope.setTag("whatsapp.event", fields.event);
	for (const [field, tagName] of Object.entries(tagMappings)) {
		const value = fields[field as keyof WhatsAppLogFields];
		if (value) {
			scope.setTag(tagName, value as string);
		}
	}
}

const extraFields: (keyof WhatsAppLogFields)[] = [
	"requestUrl",
	"fromNumber",
	"toNumber",
	"details",
];

function setSentryScopeExtras(
	scope: SentryScope,
	fields: WhatsAppLogFields,
): void {
	scope.setExtra("nodeEnv", process.env.NODE_ENV);
	scope.setExtra("vercelEnv", vercelEnv);

	for (const field of extraFields) {
		const value = fields[field];
		if (value) {
			scope.setExtra(field, value);
		}
	}
}

function captureSentryError(fields: WhatsAppLogFields): void {
	if (fields.exception instanceof Error) {
		Sentry.captureException(fields.exception);
	} else {
		Sentry.captureMessage(fields.error ?? fields.event, "error");
	}
}

/**
 * Log WhatsApp events with structured data.
 *
 * Observability is handled via:
 * - Console logs: Captured by Vercel's log ingestion
 * - OpenTelemetry spans: Created in service.ts/twilio.ts, exported via @vercel/otel
 * - Sentry: Error events are captured with full context for alerting
 */
export function logWhatsAppEvent(
	level: WhatsAppLogLevel,
	fields: WhatsAppLogFields,
): void {
	const logger =
		level === "error"
			? console.error
			: // biome-ignore lint/style/noNestedTernary: console
				level === "warn"
				? console.warn
				: console.log;

	try {
		logger("[whatsapp]", {
			service: "whatsapp",
			nodeEnv: process.env.NODE_ENV,
			vercelEnv,
			...fields,
		});
	} catch (loggingError) {
		// Logging must never break the handler, but report failures for debugging
		console.error("[whatsapp] logging failed", {
			loggingError:
				loggingError instanceof Error
					? loggingError.message
					: String(loggingError),
			originalEvent: fields.event,
		});
	}

	if (level === "error") {
		try {
			Sentry.withScope((scope) => {
				setSentryScopeTags(scope, fields);
				setSentryScopeExtras(scope, fields);
				captureSentryError(fields);
			});
		} catch (sentryError) {
			console.error("[whatsapp] sentry capture failed", {
				sentryError:
					sentryError instanceof Error
						? sentryError.message
						: String(sentryError),
				originalEvent: fields.event,
			});
		}
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
	if (fields.error) {
		span.setAttribute("whatsapp.error", fields.error);
	}
}
