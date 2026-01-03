import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InMemoryCache } from "@/lib/infrastructure/redis/mocks/in-memory-cache";

describe("InMemoryCache", () => {
	let cache: InMemoryCache;

	beforeEach(() => {
		vi.useFakeTimers();
		cache = new InMemoryCache({ ttlMs: 1000 });
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe("get/set", () => {
		it("returns null for missing key", async () => {
			expect(await cache.get("missing")).toBeNull();
		});

		it("stores and retrieves string value", async () => {
			await cache.set("key", "value");
			expect(await cache.get("key")).toBe("value");
		});

		it("stores and retrieves object value", async () => {
			const obj = { name: "test", count: 42 };
			await cache.set("key", obj);
			expect(await cache.get("key")).toEqual(obj);
		});

		it("stores and retrieves array value", async () => {
			const arr = [1, 2, 3, "four"];
			await cache.set("key", arr);
			expect(await cache.get("key")).toEqual(arr);
		});

		it("overwrites existing value", async () => {
			await cache.set("key", "first");
			await cache.set("key", "second");
			expect(await cache.get("key")).toBe("second");
		});

		it("expires value after TTL", async () => {
			await cache.set("key", "value");
			expect(await cache.get("key")).toBe("value");

			vi.advanceTimersByTime(1001);
			expect(await cache.get("key")).toBeNull();
		});

		it("resets TTL on overwrite", async () => {
			await cache.set("key", "first");

			vi.advanceTimersByTime(500);
			await cache.set("key", "second");

			vi.advanceTimersByTime(600);
			// Would have expired if TTL wasn't reset
			expect(await cache.get("key")).toBe("second");
		});
	});

	describe("delete", () => {
		it("removes existing key", async () => {
			await cache.set("key", "value");
			expect(await cache.get("key")).toBe("value");

			await cache.delete("key");
			expect(await cache.get("key")).toBeNull();
		});

		it("does not throw for missing key", async () => {
			await expect(cache.delete("nonexistent")).resolves.toBeUndefined();
		});
	});

	describe("getOrSet", () => {
		it("returns cached value without calling compute", async () => {
			await cache.set("key", "cached");
			const compute = vi.fn().mockResolvedValue("computed");

			const result = await cache.getOrSet("key", compute);

			expect(result).toBe("cached");
			expect(compute).not.toHaveBeenCalled();
		});

		it("calls compute and caches on miss", async () => {
			const compute = vi.fn().mockResolvedValue("computed");

			const result = await cache.getOrSet("key", compute);

			expect(result).toBe("computed");
			expect(compute).toHaveBeenCalledOnce();
			expect(await cache.get("key")).toBe("computed");
		});

		it("does not cache null compute results", async () => {
			const compute = vi.fn().mockResolvedValue(null);

			const result = await cache.getOrSet("key", compute);

			expect(result).toBeNull();
			expect(compute).toHaveBeenCalledOnce();
			expect(cache.has("key")).toBe(false);
		});

		it("calls compute again after TTL expires", async () => {
			let callCount = 0;
			const compute = vi.fn().mockImplementation(async () => {
				callCount++;
				return `value-${callCount}`;
			});

			const first = await cache.getOrSet("key", compute);
			expect(first).toBe("value-1");
			expect(compute).toHaveBeenCalledTimes(1);

			vi.advanceTimersByTime(1001);

			const second = await cache.getOrSet("key", compute);
			expect(second).toBe("value-2");
			expect(compute).toHaveBeenCalledTimes(2);
		});
	});

	describe("test helpers", () => {
		it("clear() removes all entries", async () => {
			await cache.set("key1", "value1");
			await cache.set("key2", "value2");
			expect(cache.size()).toBe(2);

			cache.clear();
			expect(cache.size()).toBe(0);
			expect(await cache.get("key1")).toBeNull();
			expect(await cache.get("key2")).toBeNull();
		});

		it("size() returns entry count", async () => {
			expect(cache.size()).toBe(0);

			await cache.set("key1", "value1");
			expect(cache.size()).toBe(1);

			await cache.set("key2", "value2");
			expect(cache.size()).toBe(2);
		});

		it("has() checks key existence ignoring TTL", async () => {
			expect(cache.has("key")).toBe(false);

			await cache.set("key", "value");
			expect(cache.has("key")).toBe(true);

			// has() should still return true even after TTL (for debugging)
			vi.advanceTimersByTime(1001);
			expect(cache.has("key")).toBe(true);
			// But get() should return null
			expect(await cache.get("key")).toBeNull();
		});
	});

	describe("default TTL", () => {
		it("uses 5 minute default when not specified", async () => {
			const defaultCache = new InMemoryCache();
			await defaultCache.set("key", "value");

			vi.advanceTimersByTime(4 * 60 * 1000); // 4 minutes
			expect(await defaultCache.get("key")).toBe("value");

			vi.advanceTimersByTime(2 * 60 * 1000); // 2 more minutes (6 total)
			expect(await defaultCache.get("key")).toBeNull();
		});
	});
});
