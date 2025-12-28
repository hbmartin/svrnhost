import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TokenBucketRateLimiter } from "@/lib/rate-limiter";

describe("TokenBucketRateLimiter", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe("constructor", () => {
		it("uses default configuration", () => {
			const limiter = new TokenBucketRateLimiter();
			expect(limiter.getAvailableTokens("test")).toBe(80);
		});

		it("accepts custom tokensPerSecond", () => {
			const limiter = new TokenBucketRateLimiter({ tokensPerSecond: 10 });
			// bucketSize defaults to tokensPerSecond
			expect(limiter.getAvailableTokens("test")).toBe(10);
		});

		it("accepts custom bucketSize", () => {
			const limiter = new TokenBucketRateLimiter({
				tokensPerSecond: 10,
				bucketSize: 50,
			});
			expect(limiter.getAvailableTokens("test")).toBe(50);
		});

		it("accepts custom cleanupAfterMs", () => {
			const limiter = new TokenBucketRateLimiter({ cleanupAfterMs: 1000 });
			expect(limiter.getAvailableTokens("test")).toBe(80);
		});
	});

	describe("tryAcquire", () => {
		it("returns true when tokens available", () => {
			const limiter = new TokenBucketRateLimiter({ bucketSize: 5 });
			expect(limiter.tryAcquire("key")).toBe(true);
		});

		it("decrements tokens on successful acquisition", () => {
			const limiter = new TokenBucketRateLimiter({ bucketSize: 5 });
			expect(limiter.getAvailableTokens("key")).toBe(5);
			limiter.tryAcquire("key");
			expect(limiter.getAvailableTokens("key")).toBe(4);
		});

		it("returns false when no tokens available", () => {
			const limiter = new TokenBucketRateLimiter({
				tokensPerSecond: 1,
				bucketSize: 2,
			});
			// Consume all tokens
			expect(limiter.tryAcquire("key")).toBe(true);
			expect(limiter.tryAcquire("key")).toBe(true);
			expect(limiter.tryAcquire("key")).toBe(false);
		});

		it("uses separate buckets for different keys", () => {
			const limiter = new TokenBucketRateLimiter({ bucketSize: 1 });
			expect(limiter.tryAcquire("key1")).toBe(true);
			expect(limiter.tryAcquire("key2")).toBe(true);
			expect(limiter.tryAcquire("key1")).toBe(false);
			expect(limiter.tryAcquire("key2")).toBe(false);
		});

		it("refills tokens over time", () => {
			const limiter = new TokenBucketRateLimiter({
				tokensPerSecond: 10,
				bucketSize: 10,
			});
			// Consume all tokens
			for (let _ = 0; _ < 10; _++) {
				limiter.tryAcquire("key");
			}
			expect(limiter.tryAcquire("key")).toBe(false);

			// Advance 1 second - should refill 10 tokens
			vi.advanceTimersByTime(1000);
			expect(limiter.getAvailableTokens("key")).toBe(10);
			expect(limiter.tryAcquire("key")).toBe(true);
		});

		it("does not refill above bucketSize", () => {
			const limiter = new TokenBucketRateLimiter({
				tokensPerSecond: 10,
				bucketSize: 5,
			});
			// Bucket starts at 5, advance 10 seconds
			vi.advanceTimersByTime(10000);
			// Should still be capped at 5
			expect(limiter.getAvailableTokens("key")).toBe(5);
		});

		it("partial refill on partial second", () => {
			const limiter = new TokenBucketRateLimiter({
				tokensPerSecond: 10,
				bucketSize: 10,
			});
			// Use 5 tokens
			for (let _ = 0; _ < 5; _++) {
				limiter.tryAcquire("key");
			}
			expect(limiter.getAvailableTokens("key")).toBe(5);

			// Advance 250ms - should refill 2.5 tokens
			vi.advanceTimersByTime(250);
			expect(limiter.getAvailableTokens("key")).toBe(7); // floor of 7.5
		});
	});

	describe("acquire", () => {
		it("resolves immediately when tokens available", async () => {
			const limiter = new TokenBucketRateLimiter({ bucketSize: 5 });
			await expect(limiter.acquire("key")).resolves.toBeUndefined();
		});

		it("waits for token and then resolves", async () => {
			const limiter = new TokenBucketRateLimiter({
				tokensPerSecond: 10,
				bucketSize: 1,
			});
			// Consume the one token
			limiter.tryAcquire("key");

			// Start acquiring - should wait for refill
			const acquirePromise = limiter.acquire("key", 1000);

			// Advance time to allow refill
			await vi.advanceTimersByTimeAsync(200);

			await expect(acquirePromise).resolves.toBeUndefined();
		});

		it("throws when maxWaitMs exceeded", async () => {
			const limiter = new TokenBucketRateLimiter({
				tokensPerSecond: 0.1, // 1 token per 10 seconds
				bucketSize: 1,
			});
			// Consume the one token
			limiter.tryAcquire("key");

			// Set up promise with error handler attached immediately
			let capturedError: Error | null = null;
			const acquirePromise = limiter.acquire("key", 100).catch((e) => {
				capturedError = e as Error;
			});

			// Advance time past the timeout
			await vi.advanceTimersByTimeAsync(200);
			await acquirePromise;

			expect(capturedError).not.toBeNull();
			expect(capturedError?.message).toContain("Rate limit exceeded");
			expect(capturedError?.message).toContain("key");
			expect(capturedError?.message).toContain("100ms");
		});

		it("uses default maxWaitMs of 5000", async () => {
			const limiter = new TokenBucketRateLimiter({
				tokensPerSecond: 0.0001, // Very slow refill
				bucketSize: 1,
			});
			limiter.tryAcquire("key");

			// Set up promise with error handler attached immediately
			let capturedError: Error | null = null;
			const acquirePromise = limiter.acquire("key").catch((e) => {
				capturedError = e as Error;
			});

			// Advance past 5 seconds
			await vi.advanceTimersByTimeAsync(6000);
			await acquirePromise;

			expect(capturedError).not.toBeNull();
			expect(capturedError?.message).toContain("Rate limit exceeded");
		});
	});

	describe("getAvailableTokens", () => {
		it("returns full bucket for new key", () => {
			const limiter = new TokenBucketRateLimiter({ bucketSize: 10 });
			expect(limiter.getAvailableTokens("new-key")).toBe(10);
		});

		it("returns remaining tokens after consumption", () => {
			const limiter = new TokenBucketRateLimiter({ bucketSize: 10 });
			limiter.tryAcquire("key");
			limiter.tryAcquire("key");
			limiter.tryAcquire("key");
			expect(limiter.getAvailableTokens("key")).toBe(7);
		});

		it("returns floored value", () => {
			const limiter = new TokenBucketRateLimiter({
				tokensPerSecond: 10,
				bucketSize: 10,
			});
			// Use all tokens
			for (let _ = 0; _ < 10; _++) {
				limiter.tryAcquire("key");
			}
			// Advance 50ms - should refill 0.5 tokens
			vi.advanceTimersByTime(50);
			expect(limiter.getAvailableTokens("key")).toBe(0);

			// Advance another 50ms - should be 1 token
			vi.advanceTimersByTime(50);
			expect(limiter.getAvailableTokens("key")).toBe(1);
		});
	});

	describe("getBucketCount", () => {
		it("returns 0 for new limiter", () => {
			const limiter = new TokenBucketRateLimiter();
			expect(limiter.getBucketCount()).toBe(0);
		});

		it("increments when new keys accessed", () => {
			const limiter = new TokenBucketRateLimiter();
			limiter.tryAcquire("key1");
			expect(limiter.getBucketCount()).toBe(1);
			limiter.tryAcquire("key2");
			expect(limiter.getBucketCount()).toBe(2);
			limiter.tryAcquire("key3");
			expect(limiter.getBucketCount()).toBe(3);
		});

		it("does not increment for existing keys", () => {
			const limiter = new TokenBucketRateLimiter();
			limiter.tryAcquire("key1");
			limiter.tryAcquire("key1");
			limiter.tryAcquire("key1");
			expect(limiter.getBucketCount()).toBe(1);
		});
	});

	describe("cleanup", () => {
		it("removes old buckets after cleanupAfterMs", () => {
			const limiter = new TokenBucketRateLimiter({
				cleanupAfterMs: 1000,
			});
			limiter.tryAcquire("old-key");
			expect(limiter.getBucketCount()).toBe(1);

			// Advance past cleanup time
			vi.advanceTimersByTime(2000);

			// Trigger cleanup via tryAcquire
			limiter.tryAcquire("new-key");

			// Old bucket should be cleaned up
			expect(limiter.getBucketCount()).toBe(1);
		});

		it("keeps recently used buckets", () => {
			const limiter = new TokenBucketRateLimiter({
				cleanupAfterMs: 1000,
			});
			limiter.tryAcquire("key1");
			limiter.tryAcquire("key2");

			// Advance past cleanup threshold
			vi.advanceTimersByTime(1500);

			// Access key1 to keep it fresh (this also triggers cleanup)
			limiter.tryAcquire("key1");
			// At this point cleanup runs: cutoff = 1500 - 1000 = 500
			// key1 was just accessed so lastRefill = 1500, which is > cutoff, so kept
			// key2 lastRefill = 0, which is < cutoff, so cleaned

			// key1 should be kept, key2 should be cleaned
			expect(limiter.getBucketCount()).toBe(1); // only key1
		});

		it("does not run cleanup before cleanupAfterMs", () => {
			const limiter = new TokenBucketRateLimiter({
				cleanupAfterMs: 10000,
			});
			limiter.tryAcquire("key1");

			// Advance less than cleanup time
			vi.advanceTimersByTime(5000);

			limiter.tryAcquire("key2");

			// Both buckets should still exist
			expect(limiter.getBucketCount()).toBe(2);
		});
	});

	describe("edge cases", () => {
		it("handles zero tokens consumed rapidly", () => {
			const limiter = new TokenBucketRateLimiter({
				tokensPerSecond: 100,
				bucketSize: 100,
			});

			// Rapid consumption
			for (let _ = 0; _ < 100; _++) {
				expect(limiter.tryAcquire("key")).toBe(true);
			}
			expect(limiter.tryAcquire("key")).toBe(false);
		});

		it("handles multiple keys with different consumption rates", () => {
			const limiter = new TokenBucketRateLimiter({
				tokensPerSecond: 10,
				bucketSize: 10,
			});

			// Consume 5 from key1
			for (let _ = 0; _ < 5; _++) {
				limiter.tryAcquire("key1");
			}

			// Consume 3 from key2
			for (let _ = 0; _ < 3; _++) {
				limiter.tryAcquire("key2");
			}

			expect(limiter.getAvailableTokens("key1")).toBe(5);
			expect(limiter.getAvailableTokens("key2")).toBe(7);
		});

		it("handles very small tokensPerSecond", () => {
			const limiter = new TokenBucketRateLimiter({
				tokensPerSecond: 0.001,
				bucketSize: 1,
			});

			limiter.tryAcquire("key");
			expect(limiter.getAvailableTokens("key")).toBe(0);

			// Even after 1 second, still no token (0.001 tokens)
			vi.advanceTimersByTime(1000);
			expect(limiter.getAvailableTokens("key")).toBe(0);

			// After 1000 seconds, should have 1 token
			vi.advanceTimersByTime(999000);
			expect(limiter.getAvailableTokens("key")).toBe(1);
		});

		it("handles empty string key", () => {
			const limiter = new TokenBucketRateLimiter({ bucketSize: 5 });
			expect(limiter.tryAcquire("")).toBe(true);
			expect(limiter.getAvailableTokens("")).toBe(4);
		});
	});
});
