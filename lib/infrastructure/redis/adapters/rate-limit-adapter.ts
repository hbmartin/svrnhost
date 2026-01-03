/** biome-ignore-all lint/suspicious/useAwait: tracing callbacks return Promises */
import "server-only";

import { SpanStatusCode, trace } from "@opentelemetry/api";
import { type Duration, Ratelimit } from "@upstash/ratelimit";
import type { Redis } from "@upstash/redis";
import type { RateLimitPort, RateLimitResult } from "../ports";

const tracer = trace.getTracer("redis-ratelimit");

export interface UpstashRateLimitOptions {
	/** Requests allowed per window */
	requests: number;
	/** Window duration (e.g., "1 s", "10 s", "1 m", "1 h") */
	window: Duration;
	/** Optional prefix for rate limit keys */
	prefix?: string;
	/** Enable analytics (requires waitUntil for serverless). Default: true */
	analytics?: boolean;
}

/**
 * Rate limiter using @upstash/ratelimit with sliding window algorithm.
 * Returns a pending promise for use with waitUntil for analytics.
 */
export class UpstashRateLimitAdapter implements RateLimitPort {
	private readonly ratelimit: Ratelimit;

	constructor(redis: Redis, options: UpstashRateLimitOptions) {
		this.ratelimit = new Ratelimit({
			redis,
			limiter: Ratelimit.slidingWindow(options.requests, options.window),
			prefix: options.prefix ?? "@upstash/ratelimit",
			analytics: options.analytics ?? true,
		});
	}

	async limit(key: string): Promise<RateLimitResult> {
		return tracer.startActiveSpan("ratelimit.check", async (span) => {
			span.setAttribute("ratelimit.key", key);

			try {
				const result = await this.ratelimit.limit(key);

				span.setAttribute("ratelimit.success", result.success);
				span.setAttribute("ratelimit.remaining", result.remaining);
				span.setAttribute("ratelimit.limit", result.limit);
				span.setStatus({ code: SpanStatusCode.OK });

				const rateLimitResult: RateLimitResult = {
					success: result.success,
					remaining: result.remaining,
					reset: result.reset,
				};

				// Add pending promise if analytics are enabled
				if (result.pending) {
					rateLimitResult.pending = result.pending as Promise<void>;
				}

				return rateLimitResult;
			} catch (error) {
				span.recordException(error as Error);
				span.setStatus({ code: SpanStatusCode.ERROR });

				// Fail open on rate limit errors - allow the request
				return {
					success: true,
					remaining: -1,
					reset: 0,
				};
			} finally {
				span.end();
			}
		});
	}
}
