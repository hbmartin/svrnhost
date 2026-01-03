import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InMemoryRateLimit } from "@/lib/infrastructure/redis/mocks/in-memory-rate-limit";

describe("InMemoryRateLimit", () => {
	let limiter: InMemoryRateLimit;

	beforeEach(() => {
		vi.useFakeTimers();
		limiter = new InMemoryRateLimit({ maxRequests: 3, windowMs: 1000 });
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe("limit", () => {
		it("allows requests under limit", async () => {
			const r1 = await limiter.limit("key");
			expect(r1.success).toBe(true);
			expect(r1.remaining).toBe(2);

			const r2 = await limiter.limit("key");
			expect(r2.success).toBe(true);
			expect(r2.remaining).toBe(1);

			const r3 = await limiter.limit("key");
			expect(r3.success).toBe(true);
			expect(r3.remaining).toBe(0);
		});

		it("blocks requests over limit", async () => {
			await limiter.limit("key");
			await limiter.limit("key");
			await limiter.limit("key");

			const result = await limiter.limit("key");
			expect(result.success).toBe(false);
			expect(result.remaining).toBe(0);
		});

		it("returns reset timestamp", async () => {
			const now = Date.now();
			const result = await limiter.limit("key");

			expect(result.reset).toBe(now + 1000);
		});

		it("resets after window expires", async () => {
			await limiter.limit("key");
			await limiter.limit("key");
			await limiter.limit("key");

			const blocked = await limiter.limit("key");
			expect(blocked.success).toBe(false);

			vi.advanceTimersByTime(1001);

			const allowed = await limiter.limit("key");
			expect(allowed.success).toBe(true);
			expect(allowed.remaining).toBe(2);
		});

		it("tracks separate keys independently", async () => {
			// Exhaust key1
			await limiter.limit("key1");
			await limiter.limit("key1");
			await limiter.limit("key1");
			expect((await limiter.limit("key1")).success).toBe(false);

			// key2 should still work
			const key2Result = await limiter.limit("key2");
			expect(key2Result.success).toBe(true);
			expect(key2Result.remaining).toBe(2);
		});

		it("does not return pending promise (not needed for in-memory)", async () => {
			const result = await limiter.limit("key");
			expect(result.pending).toBeUndefined();
		});
	});

	describe("test helpers", () => {
		it("reset() clears all buckets", async () => {
			await limiter.limit("key1");
			await limiter.limit("key2");
			expect(limiter.getBucketCount()).toBe(2);

			limiter.reset();
			expect(limiter.getBucketCount()).toBe(0);
		});

		it("getBucketCount() returns number of tracked keys", async () => {
			expect(limiter.getBucketCount()).toBe(0);

			await limiter.limit("key1");
			expect(limiter.getBucketCount()).toBe(1);

			await limiter.limit("key2");
			expect(limiter.getBucketCount()).toBe(2);

			await limiter.limit("key1"); // Same key, no new bucket
			expect(limiter.getBucketCount()).toBe(2);
		});

		it("getCount() returns current count for key", async () => {
			expect(limiter.getCount("key")).toBe(0);

			await limiter.limit("key");
			expect(limiter.getCount("key")).toBe(1);

			await limiter.limit("key");
			expect(limiter.getCount("key")).toBe(2);
		});
	});

	describe("edge cases", () => {
		it("handles single request limit", async () => {
			const singleLimit = new InMemoryRateLimit({
				maxRequests: 1,
				windowMs: 1000,
			});

			expect((await singleLimit.limit("key")).success).toBe(true);
			expect((await singleLimit.limit("key")).success).toBe(false);
		});

		it("handles high request limits", async () => {
			const highLimit = new InMemoryRateLimit({
				maxRequests: 1000,
				windowMs: 1000,
			});

			for (let i = 0; i < 1000; i++) {
				const result = await highLimit.limit("key");
				expect(result.success).toBe(true);
				expect(result.remaining).toBe(999 - i);
			}

			expect((await highLimit.limit("key")).success).toBe(false);
		});

		it("handles empty string key", async () => {
			const result = await limiter.limit("");
			expect(result.success).toBe(true);
			expect(limiter.getCount("")).toBe(1);
		});

		it("handles very short window", async () => {
			const shortWindow = new InMemoryRateLimit({
				maxRequests: 1,
				windowMs: 10,
			});

			expect((await shortWindow.limit("key")).success).toBe(true);
			expect((await shortWindow.limit("key")).success).toBe(false);

			vi.advanceTimersByTime(11);

			expect((await shortWindow.limit("key")).success).toBe(true);
		});
	});
});
