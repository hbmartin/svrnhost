import { describe, expect, it } from "vitest";
import {
	createRequestContext,
	generateRequestId,
	getRequestContext,
	runWithContext,
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
});
