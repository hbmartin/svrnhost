import { describe, expect, it } from "vitest";
import {
	captureRequestContext,
	createRequestContext,
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
			const startTime = 1234567890;
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
});
