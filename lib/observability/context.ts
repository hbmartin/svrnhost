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

function warnAsyncLocalStorageUnavailable(error?: unknown): void {
	if (hasWarnedAsyncLocalStorage) {
		return;
	}
	hasWarnedAsyncLocalStorage = true;
	const errorMessage = error
		? { error: error instanceof Error ? error.message : String(error) }
		: undefined;
	console.warn(
		"[observability] AsyncLocalStorage unavailable; request context disabled",
		errorMessage,
	);
}

// Initialize AsyncLocalStorage only in Node.js environment
if (typeof process !== "undefined" && process.versions?.node) {
	try {
		// Dynamic import to avoid bundling issues
		// biome-ignore lint/suspicious/noExplicitAny: dynamic require
		const asyncHooks = require("node:async_hooks") as any;
		asyncLocalStorage = new asyncHooks.AsyncLocalStorage();
	} catch (error) {
		warnAsyncLocalStorageUnavailable(error);
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
	warnAsyncLocalStorageUnavailable();
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

export function bindRequestContext(
	context?: RequestContext,
): <T>(fn: () => T) => T {
	const capturedContext = context ?? captureRequestContext();
	return <T>(fn: () => T) => runWithCapturedContext(capturedContext, fn);
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
	const requestId = getRequestIdFromHeaders(params.request?.headers);
	return createRequestContext({
		service: params.service,
		requestId,
		startTime: params.startTime,
		userId: params.userId,
		chatId: params.chatId,
	});
}

function getRequestIdFromHeaders(
	headers: Headers | undefined,
): string | undefined {
	if (!headers) {
		return undefined;
	}
	for (const headerName of requestIdHeaderNames) {
		const value = headers.get(headerName);
		if (value) {
			return value;
		}
	}
	return undefined;
}
