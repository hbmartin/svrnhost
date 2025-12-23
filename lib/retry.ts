/**
 * Retry utility with exponential backoff and jitter.
 *
 * Usage:
 * ```typescript
 * const result = await withRetry(
 *   () => someAsyncOperation(),
 *   { maxAttempts: 3, baseDelayMs: 1000 }
 * );
 * ```
 */

export interface RetryConfig {
	/** Maximum number of attempts (including the first). Default: 3 */
	maxAttempts?: number;
	/** Base delay in milliseconds. Default: 1000 */
	baseDelayMs?: number;
	/** Maximum delay in milliseconds. Default: 30000 */
	maxDelayMs?: number;
	/** Optional function to determine if an error is retryable. Default: all errors are retryable */
	shouldRetry?: (error: unknown, attempt: number) => boolean;
	/** Optional context string for logging */
	context?: string;
}

export interface RetryResult<T> {
	result: T;
	attempts: number;
}

const DEFAULT_CONFIG: Required<Omit<RetryConfig, "shouldRetry" | "context">> = {
	maxAttempts: 3,
	baseDelayMs: 1000,
	maxDelayMs: 30000,
};

/**
 * Calculate delay with exponential backoff and jitter.
 * Formula: min(maxDelay, baseDelay * 2^attempt) + random jitter (0-100ms)
 */
function calculateDelay(
	attempt: number,
	baseDelayMs: number,
	maxDelayMs: number,
): number {
	const exponentialDelay = baseDelayMs * 2 ** attempt;
	const cappedDelay = Math.min(maxDelayMs, exponentialDelay);
	const jitter = Math.random() * 100;
	return cappedDelay + jitter;
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute a function with retry logic and exponential backoff.
 *
 * @throws The last error if all retries are exhausted
 */
export async function withRetry<T>(
	fn: () => Promise<T>,
	config: RetryConfig = {},
): Promise<RetryResult<T>> {
	const maxAttempts = config.maxAttempts ?? DEFAULT_CONFIG.maxAttempts;
	const baseDelayMs = config.baseDelayMs ?? DEFAULT_CONFIG.baseDelayMs;
	const maxDelayMs = config.maxDelayMs ?? DEFAULT_CONFIG.maxDelayMs;
	const shouldRetry = config.shouldRetry ?? (() => true);
	const context = config.context ?? "operation";

	if (maxAttempts < 1) {
		throw new Error(`withRetry: maxAttempts must be at least 1, got ${maxAttempts}`);
	}

	if (!Number.isFinite(baseDelayMs)) {
		throw new Error(`withRetry: baseDelayMs must be a finite number, got ${baseDelayMs}`);
	}

	if (!Number.isFinite(maxDelayMs)) {
		throw new Error(`withRetry: maxDelayMs must be a finite number, got ${maxDelayMs}`);
	}

	if (baseDelayMs < 0) {
		throw new Error(`withRetry: baseDelayMs must be non-negative, got ${baseDelayMs}`);
	}

	if (maxDelayMs < baseDelayMs) {
		throw new Error(
			`withRetry: maxDelayMs must be >= baseDelayMs, got maxDelayMs=${maxDelayMs}, baseDelayMs=${baseDelayMs}`,
		);
	}

	let lastError: unknown;

	for (let attempt = 0; attempt < maxAttempts; attempt++) {
		try {
			const result = await fn();
			if (attempt > 0) {
				console.log(`[retry:${context}] succeeded after ${attempt + 1} attempts`);
			}
			return { result, attempts: attempt + 1 };
		} catch (error) {
			lastError = error;
			const isLastAttempt = attempt === maxAttempts - 1;

			if (isLastAttempt) {
				console.error(`[retry:${context}] all ${maxAttempts} attempts failed`, {
					error: error instanceof Error ? error.message : String(error),
				});
				break;
			}

			if (!shouldRetry(error, attempt)) {
				console.log(`[retry:${context}] error is not retryable, giving up`, {
					attempt: attempt + 1,
					error: error instanceof Error ? error.message : String(error),
				});
				break;
			}

			const delayMs = calculateDelay(attempt, baseDelayMs, maxDelayMs);
			console.log(`[retry:${context}] attempt ${attempt + 1} failed, retrying in ${Math.round(delayMs)}ms`, {
				error: error instanceof Error ? error.message : String(error),
			});

			await sleep(delayMs);
		}
	}

	throw lastError;
}

/**
 * Helper to check if an HTTP status code is retryable.
 * Retryable: 429 (rate limit), 500-599 (server errors)
 * Not retryable: 4xx (client errors except 429)
 */
export function isRetryableHttpStatus(status: number): boolean {
	if (status === 429) return true; // Rate limited
	if (status >= 500 && status < 600) return true; // Server errors
	return false;
}

/**
 * Helper to check if an error appears to be a network error.
 */
export function isNetworkError(error: unknown): boolean {
	if (error instanceof Error) {
		const message = error.message.toLowerCase();
		return (
			message.includes("network") ||
			message.includes("econnrefused") ||
			message.includes("econnreset") ||
			message.includes("etimedout") ||
			message.includes("socket") ||
			message.includes("fetch failed")
		);
	}
	return false;
}
