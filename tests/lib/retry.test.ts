import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isNetworkError, isRetryableHttpStatus, withRetry } from "@/lib/retry";

describe("withRetry", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe("successful operations", () => {
		it("returns result on first attempt success", async () => {
			const fn = vi.fn().mockResolvedValue("success");

			const resultPromise = withRetry(fn);
			await vi.runAllTimersAsync();
			const result = await resultPromise;

			expect(result).toEqual({ result: "success", attempts: 1 });
			expect(fn).toHaveBeenCalledTimes(1);
		});

		it("returns result after retry succeeds", async () => {
			const fn = vi
				.fn()
				.mockRejectedValueOnce(new Error("fail 1"))
				.mockResolvedValue("success");

			const resultPromise = withRetry(fn, { baseDelayMs: 100 });
			await vi.runAllTimersAsync();
			const result = await resultPromise;

			expect(result).toEqual({ result: "success", attempts: 2 });
			expect(fn).toHaveBeenCalledTimes(2);
		});

		it("logs success after retries", async () => {
			const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
			const fn = vi
				.fn()
				.mockRejectedValueOnce(new Error("fail"))
				.mockResolvedValue("success");

			const resultPromise = withRetry(fn, {
				baseDelayMs: 100,
				context: "test-op",
			});
			await vi.runAllTimersAsync();
			await resultPromise;

			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining("[retry:test-op] succeeded after 2 attempts"),
			);
			consoleSpy.mockRestore();
		});
	});

	describe("failure handling", () => {
		it("throws after all retries exhausted", async () => {
			const error = new Error("persistent failure");
			const fn = vi.fn().mockRejectedValue(error);

			const resultPromise = withRetry(fn, { maxAttempts: 3, baseDelayMs: 100 });
			resultPromise.catch(() => {}); // Prevent unhandled rejection warning

			await vi.runAllTimersAsync();
			await expect(resultPromise).rejects.toThrow("persistent failure");
			expect(fn).toHaveBeenCalledTimes(3);
		});

		it("attaches attempts to error object", async () => {
			const error = new Error("failure");
			const fn = vi.fn().mockRejectedValue(error);

			const resultPromise = withRetry(fn, { maxAttempts: 2, baseDelayMs: 100 });
			resultPromise.catch(() => {}); // Prevent unhandled rejection warning

			await vi.runAllTimersAsync();
			await expect(resultPromise).rejects.toThrow();
			expect((error as { attempts?: number }).attempts).toBe(2);
		});

		it("logs all attempts failed", async () => {
			const consoleSpy = vi
				.spyOn(console, "error")
				.mockImplementation(() => {});
			const fn = vi.fn().mockRejectedValue(new Error("fail"));

			const resultPromise = withRetry(fn, {
				maxAttempts: 2,
				baseDelayMs: 100,
				context: "test-op",
			});
			resultPromise.catch(() => {}); // Prevent unhandled rejection warning

			await vi.runAllTimersAsync();
			await expect(resultPromise).rejects.toThrow();
			expect(consoleSpy).toHaveBeenCalledWith(
				"[retry:test-op] all 2 attempts failed",
				expect.objectContaining({ error: "fail" }),
			);
			consoleSpy.mockRestore();
		});
	});

	describe("shouldRetry function", () => {
		it("stops retrying when shouldRetry returns false", async () => {
			const fn = vi.fn().mockRejectedValue(new Error("non-retryable"));

			const resultPromise = withRetry(fn, {
				maxAttempts: 5,
				baseDelayMs: 100,
				shouldRetry: () => false,
			});
			resultPromise.catch(() => {}); // Prevent unhandled rejection warning

			await vi.runAllTimersAsync();
			await expect(resultPromise).rejects.toThrow("non-retryable");
			expect(fn).toHaveBeenCalledTimes(1);
		});

		it("passes error and attempt to shouldRetry", async () => {
			const shouldRetry = vi.fn().mockReturnValue(true);
			const error = new Error("test error");
			const fn = vi
				.fn()
				.mockRejectedValueOnce(error)
				.mockRejectedValueOnce(error)
				.mockResolvedValue("success");

			const resultPromise = withRetry(fn, {
				maxAttempts: 5,
				baseDelayMs: 100,
				shouldRetry,
			});
			await vi.runAllTimersAsync();
			await resultPromise;

			expect(shouldRetry).toHaveBeenCalledWith(error, 0);
			expect(shouldRetry).toHaveBeenCalledWith(error, 1);
		});

		it("logs when error is not retryable", async () => {
			const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
			const fn = vi.fn().mockRejectedValue(new Error("non-retryable"));

			const resultPromise = withRetry(fn, {
				maxAttempts: 5,
				baseDelayMs: 100,
				shouldRetry: () => false,
				context: "test-op",
			});
			resultPromise.catch(() => {}); // Prevent unhandled rejection warning

			await vi.runAllTimersAsync();
			await expect(resultPromise).rejects.toThrow();
			expect(consoleSpy).toHaveBeenCalledWith(
				"[retry:test-op] error is not retryable, giving up",
				expect.objectContaining({ attempt: 1 }),
			);
			consoleSpy.mockRestore();
		});

		it("attaches attempts when stopping due to non-retryable error", async () => {
			const error = new Error("non-retryable");
			const fn = vi
				.fn()
				.mockRejectedValueOnce(new Error("first"))
				.mockRejectedValueOnce(error);

			const resultPromise = withRetry(fn, {
				maxAttempts: 5,
				baseDelayMs: 100,
				shouldRetry: (err) =>
					err instanceof Error && err.message !== "non-retryable",
			});
			resultPromise.catch(() => {}); // Prevent unhandled rejection warning

			await vi.runAllTimersAsync();
			await expect(resultPromise).rejects.toThrow("non-retryable");
			expect(fn).toHaveBeenCalledTimes(2);
			expect((error as { attempts?: number }).attempts).toBe(2);
		});
	});

	describe("config validation", () => {
		it("throws if maxAttempts is less than 1", async () => {
			const fn = vi.fn().mockResolvedValue("success");

			await expect(withRetry(fn, { maxAttempts: 0 })).rejects.toThrow(
				"maxAttempts must be at least 1",
			);
		});

		it("throws if baseDelayMs is not finite", async () => {
			const fn = vi.fn().mockResolvedValue("success");

			await expect(
				withRetry(fn, { baseDelayMs: Number.POSITIVE_INFINITY }),
			).rejects.toThrow("baseDelayMs must be a finite number");

			await expect(withRetry(fn, { baseDelayMs: Number.NaN })).rejects.toThrow(
				"baseDelayMs must be a finite number",
			);
		});

		it("throws if maxDelayMs is not finite", async () => {
			const fn = vi.fn().mockResolvedValue("success");

			await expect(
				withRetry(fn, { maxDelayMs: Number.POSITIVE_INFINITY }),
			).rejects.toThrow("maxDelayMs must be a finite number");
		});

		it("throws if baseDelayMs is negative", async () => {
			const fn = vi.fn().mockResolvedValue("success");

			await expect(withRetry(fn, { baseDelayMs: -1 })).rejects.toThrow(
				"baseDelayMs must be non-negative",
			);
		});

		it("throws if maxDelayMs is less than baseDelayMs", async () => {
			const fn = vi.fn().mockResolvedValue("success");

			await expect(
				withRetry(fn, { baseDelayMs: 1000, maxDelayMs: 500 }),
			).rejects.toThrow("maxDelayMs must be >= baseDelayMs");
		});
	});

	describe("exponential backoff", () => {
		it("uses exponential backoff with jitter", async () => {
			const fn = vi.fn().mockRejectedValue(new Error("fail"));

			const resultPromise = withRetry(fn, {
				maxAttempts: 4,
				baseDelayMs: 1000,
				maxDelayMs: 30000,
			});
			resultPromise.catch(() => {}); // Prevent unhandled rejection warning

			// Track setTimeout calls to verify backoff delays
			const setTimeoutSpy = vi.spyOn(global, "setTimeout");

			await vi.runAllTimersAsync();
			await expect(resultPromise).rejects.toThrow();

			// Verify delays were called with exponential backoff + jitter
			// Attempt 0: base * 2^0 = 1000ms + jitter
			// Attempt 1: base * 2^1 = 2000ms + jitter
			// Attempt 2: base * 2^2 = 4000ms + jitter
			const delays = setTimeoutSpy.mock.calls.map((call) => call[1] as number);
			expect(delays[0]).toBeGreaterThanOrEqual(1000);
			expect(delays[0]).toBeLessThan(1200); // base + max jitter
			expect(delays[1]).toBeGreaterThanOrEqual(2000);
			expect(delays[1]).toBeLessThan(2200);
			expect(delays[2]).toBeGreaterThanOrEqual(4000);
			expect(delays[2]).toBeLessThan(4200);
		});

		it("caps delay at maxDelayMs", async () => {
			const fn = vi.fn().mockRejectedValue(new Error("fail"));

			const resultPromise = withRetry(fn, {
				maxAttempts: 5,
				baseDelayMs: 10000,
				maxDelayMs: 15000,
			});
			resultPromise.catch(() => {}); // Prevent unhandled rejection warning

			const setTimeoutSpy = vi.spyOn(global, "setTimeout");

			await vi.runAllTimersAsync();
			await expect(resultPromise).rejects.toThrow();

			// All delays should be capped at maxDelayMs + jitter (< 15100)
			const delays = setTimeoutSpy.mock.calls.map((call) => call[1] as number);
			for (const delay of delays) {
				expect(delay).toBeLessThan(15200);
			}
		});
	});

	describe("default config", () => {
		it("uses default maxAttempts of 3", async () => {
			const fn = vi.fn().mockRejectedValue(new Error("fail"));

			const resultPromise = withRetry(fn);
			resultPromise.catch(() => {}); // Prevent unhandled rejection warning

			await vi.runAllTimersAsync();
			await expect(resultPromise).rejects.toThrow();
			expect(fn).toHaveBeenCalledTimes(3);
		});

		it("uses default context of 'operation'", async () => {
			const consoleSpy = vi
				.spyOn(console, "error")
				.mockImplementation(() => {});
			const fn = vi.fn().mockRejectedValue(new Error("fail"));

			const resultPromise = withRetry(fn, { maxAttempts: 1 });
			resultPromise.catch(() => {}); // Prevent unhandled rejection warning

			await vi.runAllTimersAsync();
			await expect(resultPromise).rejects.toThrow();
			expect(consoleSpy).toHaveBeenCalledWith(
				"[retry:operation] all 1 attempts failed",
				expect.any(Object),
			);
			consoleSpy.mockRestore();
		});
	});

	describe("logging during retries", () => {
		it("logs retry attempts with delay", async () => {
			const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
			const fn = vi
				.fn()
				.mockRejectedValueOnce(new Error("fail"))
				.mockResolvedValue("success");

			const resultPromise = withRetry(fn, {
				baseDelayMs: 1000,
				context: "test-op",
			});
			await vi.runAllTimersAsync();
			await resultPromise;

			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringMatching(
					/\[retry:test-op\] attempt 1 failed, retrying in \d+ms/,
				),
				expect.objectContaining({ error: "fail" }),
			);
			consoleSpy.mockRestore();
		});
	});
});

describe("isRetryableHttpStatus", () => {
	describe("retryable statuses", () => {
		it("returns true for 429 (rate limit)", () => {
			expect(isRetryableHttpStatus(429)).toBe(true);
		});

		it("returns true for 500 (internal server error)", () => {
			expect(isRetryableHttpStatus(500)).toBe(true);
		});

		it("returns true for 502 (bad gateway)", () => {
			expect(isRetryableHttpStatus(502)).toBe(true);
		});

		it("returns true for 503 (service unavailable)", () => {
			expect(isRetryableHttpStatus(503)).toBe(true);
		});

		it("returns true for 504 (gateway timeout)", () => {
			expect(isRetryableHttpStatus(504)).toBe(true);
		});

		it("returns true for 599", () => {
			expect(isRetryableHttpStatus(599)).toBe(true);
		});
	});

	describe("non-retryable statuses", () => {
		it("returns false for 400 (bad request)", () => {
			expect(isRetryableHttpStatus(400)).toBe(false);
		});

		it("returns false for 401 (unauthorized)", () => {
			expect(isRetryableHttpStatus(401)).toBe(false);
		});

		it("returns false for 403 (forbidden)", () => {
			expect(isRetryableHttpStatus(403)).toBe(false);
		});

		it("returns false for 404 (not found)", () => {
			expect(isRetryableHttpStatus(404)).toBe(false);
		});

		it("returns false for 200 (OK)", () => {
			expect(isRetryableHttpStatus(200)).toBe(false);
		});

		it("returns false for 201 (Created)", () => {
			expect(isRetryableHttpStatus(201)).toBe(false);
		});

		it("returns false for 600", () => {
			expect(isRetryableHttpStatus(600)).toBe(false);
		});
	});
});

describe("isNetworkError", () => {
	describe("network errors", () => {
		it("returns true for network error message", () => {
			expect(isNetworkError(new Error("Network error occurred"))).toBe(true);
		});

		it("returns true for ECONNREFUSED", () => {
			expect(isNetworkError(new Error("connect ECONNREFUSED"))).toBe(true);
		});

		it("returns true for ECONNRESET", () => {
			expect(isNetworkError(new Error("read ECONNRESET"))).toBe(true);
		});

		it("returns true for ETIMEDOUT", () => {
			expect(isNetworkError(new Error("connect ETIMEDOUT"))).toBe(true);
		});

		it("returns true for socket errors", () => {
			expect(isNetworkError(new Error("socket hang up"))).toBe(true);
		});

		it("returns true for fetch failed errors", () => {
			expect(isNetworkError(new Error("fetch failed"))).toBe(true);
		});

		it("is case insensitive", () => {
			expect(isNetworkError(new Error("NETWORK ERROR"))).toBe(true);
			expect(isNetworkError(new Error("Network Error"))).toBe(true);
		});
	});

	describe("non-network errors", () => {
		it("returns false for regular errors", () => {
			expect(isNetworkError(new Error("Something went wrong"))).toBe(false);
		});

		it("returns false for null", () => {
			expect(isNetworkError(null)).toBe(false);
		});

		it("returns false for undefined", () => {
			expect(isNetworkError(undefined)).toBe(false);
		});

		it("returns false for strings", () => {
			expect(isNetworkError("network error")).toBe(false);
		});

		it("returns false for numbers", () => {
			expect(isNetworkError(500)).toBe(false);
		});

		it("returns false for objects without message", () => {
			expect(isNetworkError({ code: "ECONNRESET" })).toBe(false);
		});
	});
});
