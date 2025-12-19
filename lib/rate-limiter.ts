/**
 * Token bucket rate limiter for per-key rate limiting.
 *
 * Implements the token bucket algorithm where tokens are added at a fixed rate
 * and each operation consumes one token. This allows for controlled bursting
 * while maintaining a long-term average rate.
 *
 * Note: This is an in-memory implementation. In a serverless environment,
 * state is not shared across instances. This provides best-effort rate limiting
 * within a single instance, which is acceptable for WhatsApp webhook processing
 * where messages typically arrive on the same instance in quick succession.
 */

interface BucketState {
	tokens: number;
	lastRefill: number;
}

export interface RateLimiterConfig {
	/** Tokens added per second. Default: 80 (Twilio WhatsApp MPS limit) */
	tokensPerSecond?: number;
	/** Maximum tokens in bucket (burst capacity). Default: same as tokensPerSecond */
	bucketSize?: number;
	/** Time in ms after which inactive buckets are cleaned up. Default: 300000 (5 min) */
	cleanupAfterMs?: number;
}

const DEFAULT_CONFIG = {
	tokensPerSecond: 80,
	bucketSize: 80,
	cleanupAfterMs: 300000, // 5 minutes
};

export class TokenBucketRateLimiter {
	private buckets: Map<string, BucketState> = new Map();
	private readonly tokensPerSecond: number;
	private readonly bucketSize: number;
	private readonly cleanupAfterMs: number;
	private lastCleanup: number = Date.now();

	constructor(config: RateLimiterConfig = {}) {
		this.tokensPerSecond = config.tokensPerSecond ?? DEFAULT_CONFIG.tokensPerSecond;
		this.bucketSize = config.bucketSize ?? this.tokensPerSecond;
		this.cleanupAfterMs = config.cleanupAfterMs ?? DEFAULT_CONFIG.cleanupAfterMs;
	}

	/**
	 * Refill tokens based on elapsed time since last refill.
	 */
	private refillBucket(bucket: BucketState, now: number): void {
		const elapsedMs = now - bucket.lastRefill;
		const tokensToAdd = (elapsedMs / 1000) * this.tokensPerSecond;
		bucket.tokens = Math.min(this.bucketSize, bucket.tokens + tokensToAdd);
		bucket.lastRefill = now;
	}

	/**
	 * Get or create a bucket for the given key.
	 */
	private getBucket(key: string, now: number): BucketState {
		let bucket = this.buckets.get(key);

		if (!bucket) {
			bucket = {
				tokens: this.bucketSize, // Start with full bucket
				lastRefill: now,
			};
			this.buckets.set(key, bucket);
		} else {
			this.refillBucket(bucket, now);
		}

		return bucket;
	}

	/**
	 * Clean up buckets that haven't been used recently.
	 */
	private maybeCleanup(now: number): void {
		if (now - this.lastCleanup < this.cleanupAfterMs) {
			return;
		}

		this.lastCleanup = now;
		const cutoff = now - this.cleanupAfterMs;

		for (const [key, bucket] of this.buckets.entries()) {
			if (bucket.lastRefill < cutoff) {
				this.buckets.delete(key);
			}
		}
	}

	/**
	 * Try to acquire a token without waiting.
	 * @returns true if token was acquired, false if rate limited
	 */
	tryAcquire(key: string): boolean {
		const now = Date.now();
		this.maybeCleanup(now);

		const bucket = this.getBucket(key, now);

		if (bucket.tokens >= 1) {
			bucket.tokens -= 1;
			return true;
		}

		return false;
	}

	/**
	 * Acquire a token, waiting if necessary.
	 * @param maxWaitMs Maximum time to wait for a token. Default: 5000ms
	 * @throws Error if token cannot be acquired within maxWaitMs
	 */
	async acquire(key: string, maxWaitMs = 5000): Promise<void> {
		const startTime = Date.now();

		while (true) {
			if (this.tryAcquire(key)) {
				return;
			}

			const elapsed = Date.now() - startTime;
			if (elapsed >= maxWaitMs) {
				throw new Error(`Rate limit exceeded for key: ${key}. Could not acquire token within ${maxWaitMs}ms`);
			}

			// Calculate wait time until next token is available
			const now = Date.now();
			const bucket = this.getBucket(key, now);
			const tokensNeeded = 1 - bucket.tokens;
			const waitMs = Math.ceil((tokensNeeded / this.tokensPerSecond) * 1000);

			// Wait for the shorter of: time until next token, or remaining allowed wait time
			const remainingWait = maxWaitMs - elapsed;
			const actualWait = Math.min(waitMs + 10, remainingWait); // +10ms buffer

			await new Promise((resolve) => setTimeout(resolve, actualWait));
		}
	}

	/**
	 * Get the number of available tokens for a key (for testing/monitoring).
	 */
	getAvailableTokens(key: string): number {
		const now = Date.now();
		const bucket = this.getBucket(key, now);
		return Math.floor(bucket.tokens);
	}

	/**
	 * Get the current number of tracked buckets (for monitoring).
	 */
	getBucketCount(): number {
		return this.buckets.size;
	}
}

/**
 * Singleton rate limiter instance for WhatsApp sends.
 * Uses Twilio's 80 MPS limit for WhatsApp Business API.
 */
export const whatsappRateLimiter = new TokenBucketRateLimiter({
	tokensPerSecond: 80,
	bucketSize: 80,
});
