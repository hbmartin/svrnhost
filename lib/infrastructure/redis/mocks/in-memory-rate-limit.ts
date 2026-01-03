/** biome-ignore-all lint/suspicious/useAwait: async interface implementation */
import type { RateLimitPort, RateLimitResult } from "../ports";

interface BucketState {
	count: number;
	windowStart: number;
}

/**
 * In-memory rate limiter for unit tests.
 * Implements simple fixed window algorithm.
 */
export class InMemoryRateLimit implements RateLimitPort {
	private readonly buckets = new Map<string, BucketState>();
	private readonly maxRequests: number;
	private readonly windowMs: number;

	constructor(options: { maxRequests: number; windowMs: number }) {
		this.maxRequests = options.maxRequests;
		this.windowMs = options.windowMs;
	}

	async limit(key: string): Promise<RateLimitResult> {
		const now = Date.now();
		let bucket = this.buckets.get(key);

		// Reset window if expired
		if (!bucket || now - bucket.windowStart >= this.windowMs) {
			bucket = { count: 0, windowStart: now };
			this.buckets.set(key, bucket);
		}

		const reset = bucket.windowStart + this.windowMs;

		if (bucket.count >= this.maxRequests) {
			return {
				success: false,
				remaining: 0,
				reset,
			};
		}

		bucket.count++;
		const remaining = Math.max(0, this.maxRequests - bucket.count);

		return {
			success: true,
			remaining,
			reset,
		};
	}

	/** Test helper: reset all buckets */
	reset(): void {
		this.buckets.clear();
	}

	/** Test helper: get bucket count */
	getBucketCount(): number {
		return this.buckets.size;
	}

	/** Test helper: get current count for a key */
	getCount(key: string): number {
		return this.buckets.get(key)?.count ?? 0;
	}
}
