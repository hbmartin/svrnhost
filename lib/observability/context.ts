import type { AsyncLocalStorage as AsyncLocalStorageType } from "node:async_hooks";
import type { RequestContext } from "./types";

// AsyncLocalStorage is only available in Node.js runtime
// In browser/edge environments, we use a simple fallback
let asyncLocalStorage: AsyncLocalStorageType<RequestContext> | null = null;

// Initialize AsyncLocalStorage only in Node.js environment
if (typeof process !== "undefined" && process.versions?.node) {
	try {
		// Dynamic import to avoid bundling issues
		// biome-ignore lint/suspicious/noExplicitAny: dynamic require
		const asyncHooks = require("node:async_hooks") as any;
		asyncLocalStorage = new asyncHooks.AsyncLocalStorage();
	} catch {
		// AsyncLocalStorage not available
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
	// Fallback: just run the function without context
	return fn();
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
export function createRequestContext(params: {
	service: string;
	requestId?: string | undefined;
	startTime?: number | undefined;
	userId?: string | undefined;
	chatId?: string | undefined;
}): RequestContext {
	return {
		requestId: params.requestId ?? generateRequestId(),
		service: params.service,
		startTime: params.startTime ?? Date.now(),
		userId: params.userId,
		chatId: params.chatId,
	};
}
