import type { AsyncLocalStorage as AsyncLocalStorageType } from "node:async_hooks";
import type { RequestContext } from "./types";

interface RequestContextParams {
	service: string;
	requestId?: string | undefined;
	startTime?: number | undefined;
	userId?: string | undefined;
	chatId?: string | undefined;
}

interface RequestContextFromRequestParams {
	request: Request;
	service: string;
	startTime?: number | undefined;
	userId?: string | undefined;
	chatId?: string | undefined;
}

const requestIdHeaderNames = ["x-request-id", "x-vercel-id"];

// AsyncLocalStorage is only available in Node.js runtime
// In browser/edge environments, we use a simple fallback
let asyncLocalStorage: AsyncLocalStorageType<RequestContext> | null = null;
let hasWarnedAsyncLocalStorage = false;

// Initialize AsyncLocalStorage only in Node.js environment
if (typeof process !== "undefined" && process.versions?.node) {
	try {
		// Dynamic import to avoid bundling issues
		// biome-ignore lint/suspicious/noExplicitAny: dynamic require
		const asyncHooks = require("node:async_hooks") as any;
		asyncLocalStorage = new asyncHooks.AsyncLocalStorage();
	} catch (error) {
		if (!hasWarnedAsyncLocalStorage) {
			hasWarnedAsyncLocalStorage = true;
			console.warn(
				"[observability] AsyncLocalStorage unavailable; request context disabled",
				{
					error: error instanceof Error ? error.message : String(error),
				},
			);
		}
	}
}

/**
 * Get the current request context from AsyncLocalStorage.
 * Returns undefined if called outside of a request context or in browser.
 */
export function getRequestContext(): RequestContext | undefined {
	return asyncLocalStorage?.getStore();
}

/**
 * Execute a function within a request context.
 * The context will be available via getRequestContext() for all
 * synchronous and asynchronous code within the function.
 * In environments without AsyncLocalStorage, just runs the function.
 */
export function runWithContext<T>(context: RequestContext, fn: () => T): T {
	if (asyncLocalStorage) {
		return asyncLocalStorage.run(context, fn);
	}
	if (!hasWarnedAsyncLocalStorage) {
		hasWarnedAsyncLocalStorage = true;
		console.warn(
			"[observability] AsyncLocalStorage unavailable; request context disabled",
		);
	}
	// Fallback: just run the function without context
	return fn();
}

export function runWithRequestContext<T>(
	params: RequestContextFromRequestParams,
	fn: () => T,
): T {
	const ctx = createRequestContextFromRequest(params);
	return runWithContext(ctx, fn);
}

export function captureRequestContext(): RequestContext | undefined {
	const ctx = getRequestContext();
	if (!ctx) {
		return undefined;
	}
	return { ...ctx };
}

export function runWithCapturedContext<T>(
	context: RequestContext | undefined,
	fn: () => T,
): T {
	if (!context) {
		return fn();
	}
	return runWithContext(context, fn);
}

/**
 * Generate a unique request ID.
 * Format: req_<timestamp_base36>_<random_base36>
 */
export function generateRequestId(): string {
	return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Create a new request context with the given parameters.
 */
export function createRequestContext(
	params: RequestContextParams,
): RequestContext {
	return {
		requestId: params.requestId ?? generateRequestId(),
		service: params.service,
		startTime: params.startTime ?? Date.now(),
		userId: params.userId,
		chatId: params.chatId,
	};
}

export function createRequestContextFromRequest(
	params: RequestContextFromRequestParams,
): RequestContext {
	const requestId = getRequestIdFromHeaders(params.request.headers);
	return createRequestContext({
		service: params.service,
		requestId,
		startTime: params.startTime,
		userId: params.userId,
		chatId: params.chatId,
	});
}

function getRequestIdFromHeaders(headers: Headers): string | undefined {
	for (const headerName of requestIdHeaderNames) {
		const value = headers.get(headerName);
		if (value) {
			return value;
		}
	}
	return undefined;
}
