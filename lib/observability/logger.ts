import * as Sentry from "@sentry/nextjs";
import { getRequestContext } from "./context";
import type { LogFields, LogLevel } from "./types";

// Get vercelEnv from process.env to avoid importing server-only config
const vercelEnv = process.env["VERCEL_ENV"];

interface ServiceLogger {
	debug: (fields: LogFields) => void;
	info: (fields: LogFields) => void;
	warn: (fields: LogFields) => void;
	error: (fields: LogFields) => void;
}

interface EnrichedLogFields extends LogFields {
	service: string;
	nodeEnv: string | undefined;
	vercelEnv: string | undefined;
	requestId?: string;
	userId?: string;
	chatId?: string;
}

function setSentryScopeTags(
	scope: Sentry.Scope,
	service: string,
	enriched: EnrichedLogFields,
	fields: LogFields,
): void {
	scope.setTag("service", service);
	scope.setTag("event", fields.event);
	if (enriched.requestId) {
		scope.setTag("request_id", enriched.requestId);
	}
	if (enriched.userId) {
		scope.setTag("user_id", enriched.userId);
	}
	if (enriched.chatId) {
		scope.setTag("chat_id", enriched.chatId);
	}
	if (fields.direction) {
		scope.setTag("direction", fields.direction);
	}
}

function setSentryScopeExtras(scope: Sentry.Scope, fields: LogFields): void {
	scope.setExtra("nodeEnv", process.env.NODE_ENV);
	scope.setExtra("vercelEnv", vercelEnv);
	if (fields.details) {
		scope.setExtra("details", fields.details);
	}
}

function captureSentryError(fields: LogFields): void {
	if (fields.exception instanceof Error) {
		Sentry.captureException(fields.exception);
	} else {
		Sentry.captureMessage(fields.error ?? fields.event, "error");
	}
}

function captureToSentry(
	service: string,
	enriched: EnrichedLogFields,
	fields: LogFields,
): void {
	try {
		Sentry.withScope((scope) => {
			setSentryScopeTags(scope, service, enriched, fields);
			setSentryScopeExtras(scope, fields);
			captureSentryError(fields);
		});
	} catch (sentryError) {
		console.error(`[${service}] sentry capture failed`, {
			sentryError:
				sentryError instanceof Error
					? sentryError.message
					: String(sentryError),
			originalEvent: fields.event,
		});
	}
}

/**
 * Log an event with structured data.
 *
 * Observability is handled via:
 * - Console logs: Captured by Vercel's log ingestion
 * - Sentry: Error events are captured with full context for alerting
 *
 * The logger automatically enriches logs with requestId from the current context.
 */
export function log(service: string, level: LogLevel, fields: LogFields): void {
	const ctx = getRequestContext();

	const enriched = {
		service,
		nodeEnv: process.env.NODE_ENV,
		vercelEnv,
		requestId: ctx?.requestId ?? fields.requestId,
		userId: ctx?.userId ?? fields.userId,
		chatId: ctx?.chatId ?? fields.chatId,
		...fields,
	};

	const logger =
		level === "error"
			? console.error
			: // biome-ignore lint/style/noNestedTernary: console selection
				level === "warn"
				? console.warn
				: console.log;

	try {
		logger(`[${service}]`, enriched);
	} catch (loggingError) {
		// Logging must never break the handler
		console.error(`[${service}] logging failed`, {
			loggingError:
				loggingError instanceof Error
					? loggingError.message
					: String(loggingError),
			originalEvent: fields.event,
		});
	}

	if (level === "error") {
		captureToSentry(service, enriched, fields);
	}
}

/**
 * Create a service-specific logger.
 *
 * @example
 * const chatLogger = createLogger("chat");
 * chatLogger.info({ event: "chat.message.received", details: { chatId } });
 */
export function createLogger(service: string): ServiceLogger {
	return {
		debug: (fields: LogFields) => log(service, "debug", fields),
		info: (fields: LogFields) => log(service, "info", fields),
		warn: (fields: LogFields) => log(service, "warn", fields),
		error: (fields: LogFields) => log(service, "error", fields),
	};
}
