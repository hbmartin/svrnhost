import { describe, expect, it } from "vitest";
import {
	bindRequestContext,
	captureRequestContext,
	createRequestContext,
	createRequestContextFromRequest,
	generateRequestId,
	getRequestContext,
	runWithCapturedContext,
	runWithContext,
	runWithRequestContext,
} from "@/lib/observability/context";

describe("lib/observability/context", () => {
	describe("generateRequestId", () => {
		it("generates a request ID with req_ prefix", () => {
			const id = generateRequestId();
			expect(id).toMatch(/^req_[a-z0-9]+_[a-z0-9]+$/);
		});

		it("generates unique IDs", () => {
			const ids = new Set<string>();
			for (let i = 0; i < 100; i++) {
				ids.add(generateRequestId());
			}
			expect(ids.size).toBe(100);
		});
	});

	describe("createRequestContext", () => {
		it("creates a context with required service field", () => {
			const ctx = createRequestContext({ service: "test" });
			expect(ctx.service).toBe("test");
			expect(ctx.requestId).toMatch(/^req_/);
			expect(ctx.startTime).toBeLessThanOrEqual(Date.now());
		});

		it("uses provided requestId", () => {
			const ctx = createRequestContext({
				service: "test",
				requestId: "custom-id",
			});
			expect(ctx.requestId).toBe("custom-id");
		});

		it("uses provided startTime", () => {
			const startTime = 1_234_567_890;
			const ctx = createRequestContext({ service: "test", startTime });
			expect(ctx.startTime).toBe(startTime);
		});

		it("includes optional userId and chatId", () => {
			const ctx = createRequestContext({
				service: "test",
				userId: "user-123",
				chatId: "chat-456",
			});
			expect(ctx.userId).toBe("user-123");
			expect(ctx.chatId).toBe("chat-456");
		});
	});

	describe("getRequestContext", () => {
		it("returns undefined outside of context", () => {
			const ctx = getRequestContext();
			expect(ctx).toBeUndefined();
		});
	});

	describe("runWithContext", () => {
		it("provides context within the callback", () => {
			const testContext = createRequestContext({
				service: "test",
				requestId: "test-req-id",
			});

			runWithContext(testContext, () => {
				const ctx = getRequestContext();
				expect(ctx).toBeDefined();
				expect(ctx?.requestId).toBe("test-req-id");
				expect(ctx?.service).toBe("test");
			});
		});

		it("returns the callback result", () => {
			const testContext = createRequestContext({ service: "test" });
			const result = runWithContext(testContext, () => "test-result");
			expect(result).toBe("test-result");
		});

		it("context is not available after runWithContext completes", () => {
			const testContext = createRequestContext({ service: "test" });
			runWithContext(testContext, () => {
				// Context available here
			});
			// Context not available here
			expect(getRequestContext()).toBeUndefined();
		});

		it("handles async functions", async () => {
			const testContext = createRequestContext({
				service: "test",
				requestId: "async-req-id",
			});

			const result = await runWithContext(testContext, async () => {
				await new Promise((resolve) => setTimeout(resolve, 10));
				const ctx = getRequestContext();
				return ctx?.requestId;
			});

			expect(result).toBe("async-req-id");
		});

		it("supports nested contexts", () => {
			const outerContext = createRequestContext({
				service: "outer",
				requestId: "outer-id",
			});
			const innerContext = createRequestContext({
				service: "inner",
				requestId: "inner-id",
			});

			runWithContext(outerContext, () => {
				expect(getRequestContext()?.requestId).toBe("outer-id");

				runWithContext(innerContext, () => {
					expect(getRequestContext()?.requestId).toBe("inner-id");
				});

				// Outer context restored
				expect(getRequestContext()?.requestId).toBe("outer-id");
			});
		});
	});

	describe("runWithRequestContext", () => {
		it("uses requestId from x-request-id header", () => {
			const request = new Request("https://example.test", {
				headers: { "x-request-id": "header-request-id" },
			});

			const result = runWithRequestContext(
				{ request, service: "test" },
				() => getRequestContext()?.requestId,
			);

			expect(result).toBe("header-request-id");
		});

		it("falls back to x-vercel-id when x-request-id is missing", () => {
			const request = new Request("https://example.test", {
				headers: { "x-vercel-id": "vercel-request-id" },
			});

			const result = runWithRequestContext(
				{ request, service: "test" },
				() => getRequestContext()?.requestId,
			);

			expect(result).toBe("vercel-request-id");
		});

		it("prefers x-request-id when both headers are present", () => {
			const request = new Request("https://example.test", {
				headers: {
					"x-request-id": "primary-request-id",
					"x-vercel-id": "secondary-request-id",
				},
			});

			const result = runWithRequestContext(
				{ request, service: "test" },
				() => getRequestContext()?.requestId,
			);

			expect(result).toBe("primary-request-id");
		});

		it("generates a requestId when no headers are provided", () => {
			const request = new Request("https://example.test");

			const result = runWithRequestContext(
				{ request, service: "test" },
				() => getRequestContext()?.requestId,
			);

			expect(result).toMatch(/^req_/);
		});
	});

	describe("captureRequestContext", () => {
		it("reuses captured context outside the original async scope", () => {
			const initialContext = createRequestContext({
				service: "test",
				requestId: "captured-id",
			});
			let captured: ReturnType<typeof captureRequestContext> | undefined;

			runWithContext(initialContext, () => {
				captured = captureRequestContext();
			});

			const result = runWithCapturedContext(captured, () => {
				return getRequestContext()?.requestId;
			});

			expect(result).toBe("captured-id");
			expect(getRequestContext()).toBeUndefined();
		});
	});

	describe("bindRequestContext", () => {
		it("runs callbacks with the captured request context", () => {
			const initialContext = createRequestContext({
				service: "test",
				requestId: "bound-id",
			});
			let runInBackground: ReturnType<typeof bindRequestContext>;

			runWithContext(initialContext, () => {
				runInBackground = bindRequestContext();
			});

			const result = runInBackground(() => getRequestContext()?.requestId);
			expect(result).toBe("bound-id");
			expect(getRequestContext()).toBeUndefined();
		});

		it("uses the provided context when explicitly passed", () => {
			const explicitContext = createRequestContext({
				service: "test",
				requestId: "explicit-id",
			});
			const runInBackground = bindRequestContext(explicitContext);

			const result = runInBackground(() => getRequestContext()?.requestId);
			expect(result).toBe("explicit-id");
			expect(getRequestContext()).toBeUndefined();
		});

		it("runs without context when called outside of context", () => {
			// Called outside any context - captureRequestContext returns undefined
			const runInBackground = bindRequestContext();

			let callbackExecuted = false;
			const result = runInBackground(() => {
				callbackExecuted = true;
				return getRequestContext();
			});

			expect(callbackExecuted).toBe(true);
			expect(result).toBeUndefined();
		});
	});

	describe("captureRequestContext", () => {
		it("returns undefined when called outside of context", () => {
			const captured = captureRequestContext();
			expect(captured).toBeUndefined();
		});

		it("returns a copy of the context, not the original", () => {
			const originalContext = createRequestContext({
				service: "test",
				requestId: "original-id",
				userId: "user-123",
			});

			let captured: ReturnType<typeof captureRequestContext>;
			runWithContext(originalContext, () => {
				captured = captureRequestContext();
			});

			expect(captured).toBeDefined();
			expect(captured).not.toBe(originalContext);
			expect(captured?.requestId).toBe("original-id");
			expect(captured?.userId).toBe("user-123");
		});
	});

	describe("runWithCapturedContext", () => {
		it("runs function without context when context is undefined", () => {
			let callbackExecuted = false;
			const result = runWithCapturedContext(undefined, () => {
				callbackExecuted = true;
				return "executed";
			});

			expect(callbackExecuted).toBe(true);
			expect(result).toBe("executed");
			expect(getRequestContext()).toBeUndefined();
		});

		it("provides context when context is defined", () => {
			const context = createRequestContext({
				service: "test",
				requestId: "ctx-id",
			});

			const result = runWithCapturedContext(context, () => {
				return getRequestContext()?.requestId;
			});

			expect(result).toBe("ctx-id");
		});
	});

	describe("createRequestContextFromRequest", () => {
		it("handles request with undefined headers gracefully", () => {
			// Create a minimal request-like object with undefined headers
			const requestLike = {
				headers: undefined,
			} as unknown as Request;

			const ctx = createRequestContextFromRequest({
				request: requestLike,
				service: "test",
			});

			// Should generate a requestId when headers are undefined
			expect(ctx.requestId).toMatch(/^req_/);
			expect(ctx.service).toBe("test");
		});

		it("passes through optional userId parameter", () => {
			const request = new Request("https://example.test");
			const ctx = createRequestContextFromRequest({
				request,
				service: "test",
				userId: "user-456",
			});

			expect(ctx.userId).toBe("user-456");
			expect(ctx.service).toBe("test");
		});

		it("passes through optional chatId parameter", () => {
			const request = new Request("https://example.test");
			const ctx = createRequestContextFromRequest({
				request,
				service: "test",
				chatId: "chat-789",
			});

			expect(ctx.chatId).toBe("chat-789");
		});

		it("passes through optional startTime parameter", () => {
			const request = new Request("https://example.test");
			const startTime = 1_700_000_000_000;
			const ctx = createRequestContextFromRequest({
				request,
				service: "test",
				startTime,
			});

			expect(ctx.startTime).toBe(startTime);
		});

		it("generates requestId when no request ID headers present", () => {
			const request = new Request("https://example.test");
			const ctx = createRequestContextFromRequest({
				request,
				service: "test",
			});

			expect(ctx.requestId).toMatch(/^req_/);
		});

		it("extracts requestId from x-request-id header", () => {
			const request = new Request("https://example.test", {
				headers: { "x-request-id": "from-header" },
			});
			const ctx = createRequestContextFromRequest({
				request,
				service: "test",
			});

			expect(ctx.requestId).toBe("from-header");
		});
	});

	describe("getRequestContext", () => {
		it("returns the full context object inside runWithContext", () => {
			const testContext = createRequestContext({
				service: "test-service",
				requestId: "test-id",
				userId: "user-abc",
				chatId: "chat-xyz",
				startTime: 1_234_567_890,
			});

			runWithContext(testContext, () => {
				const ctx = getRequestContext();
				expect(ctx).toBeDefined();
				expect(ctx?.service).toBe("test-service");
				expect(ctx?.requestId).toBe("test-id");
				expect(ctx?.userId).toBe("user-abc");
				expect(ctx?.chatId).toBe("chat-xyz");
				expect(ctx?.startTime).toBe(1_234_567_890);
			});
		});
	});

	describe("runWithContext error handling", () => {
		it("propagates errors thrown in callback", () => {
			const testContext = createRequestContext({ service: "test" });

			expect(() => {
				runWithContext(testContext, () => {
					throw new Error("Test error");
				});
			}).toThrow("Test error");
		});

		it("propagates rejected promises in async callbacks", async () => {
			const testContext = createRequestContext({ service: "test" });

			await expect(
				runWithContext(testContext, async () => {
					throw new Error("Async error");
				}),
			).rejects.toThrow("Async error");
		});

		it("cleans up context even after error", () => {
			const testContext = createRequestContext({ service: "test" });

			try {
				runWithContext(testContext, () => {
					throw new Error("Test error");
				});
			} catch {
				// Ignore
			}

			expect(getRequestContext()).toBeUndefined();
		});
	});

	describe("runWithRequestContext", () => {
		it("passes userId and chatId to context", () => {
			const request = new Request("https://example.test");

			const result = runWithRequestContext(
				{
					request,
					service: "test",
					userId: "user-from-param",
					chatId: "chat-from-param",
				},
				() => {
					const ctx = getRequestContext();
					return { userId: ctx?.userId, chatId: ctx?.chatId };
				},
			);

			expect(result.userId).toBe("user-from-param");
			expect(result.chatId).toBe("chat-from-param");
		});

		it("passes startTime to context", () => {
			const request = new Request("https://example.test");
			const startTime = 9_999_999_999;

			const result = runWithRequestContext(
				{ request, service: "test", startTime },
				() => getRequestContext()?.startTime,
			);

			expect(result).toBe(startTime);
		});
	});

	describe("generateRequestId format", () => {
		it("uses base36 encoding for timestamp", () => {
			const id = generateRequestId();
			const parts = id.split("_");
			expect(parts).toHaveLength(3);
			expect(parts[0]).toBe("req");
			// Both parts should be valid base36 strings
			expect(Number.isNaN(Number.parseInt(parts[1], 36))).toBe(false);
			expect(Number.isNaN(Number.parseInt(parts[2], 36))).toBe(false);
		});

		it("generates IDs with reasonable timestamp values", () => {
			const before = Date.now();
			const id = generateRequestId();
			const after = Date.now();

			const timestampPart = id.split("_")[1];
			const timestamp = Number.parseInt(timestampPart, 36);

			expect(timestamp).toBeGreaterThanOrEqual(before);
			expect(timestamp).toBeLessThanOrEqual(after);
		});
	});
});
