export type LogLevel = "debug" | "info" | "warn" | "error";

export type Direction = "inbound" | "outbound" | "internal";

export interface RequestContext {
	requestId: string;
	userId?: string | undefined;
	chatId?: string | undefined;
	service: string;
	startTime: number;
}

export interface LogFields {
	event: string;
	direction?: Direction | undefined;
	requestId?: string | undefined;
	userId?: string | undefined;
	chatId?: string | undefined;
	error?: string | undefined;
	exception?: unknown;
	details?: Record<string, unknown> | undefined;
	durationMs?: number | undefined;
}
