import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	createRequestContext,
	runWithContext,
} from "@/lib/observability/context";
import { createLogger, log } from "@/lib/observability/logger";

// Mock Sentry
const mockSetTag = vi.fn();
const mockSetExtra = vi.fn();
const mockCaptureException = vi.fn();
const mockCaptureMessage = vi.fn();
const mockWithScope = vi.fn((callback: (scope: unknown) => void) => {
	callback({
		setTag: mockSetTag,
		setExtra: mockSetExtra,
	});
});

vi.mock("@sentry/nextjs", () => ({
	withScope: (callback: (scope: unknown) => void) => mockWithScope(callback),
	captureException: (e: unknown) => mockCaptureException(e),
	captureMessage: (msg: string, level: string) =>
		mockCaptureMessage(msg, level),
}));

describe("lib/observability/logger", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("log", () => {
		describe("log levels", () => {
			it("logs debug events with console.log", () => {
				const consoleSpy = vi
					.spyOn(console, "log")
					.mockImplementation(() => {});

				log("test", "debug", { event: "test.debug" });

				expect(consoleSpy).toHaveBeenCalledWith(
					"[test]",
					expect.objectContaining({
						service: "test",
						event: "test.debug",
					}),
				);
				consoleSpy.mockRestore();
			});

			it("logs info events with console.log", () => {
				const consoleSpy = vi
					.spyOn(console, "log")
					.mockImplementation(() => {});

				log("test", "info", { event: "test.info" });

				expect(consoleSpy).toHaveBeenCalledWith(
					"[test]",
					expect.objectContaining({
						service: "test",
						event: "test.info",
					}),
				);
				consoleSpy.mockRestore();
			});

			it("logs warn events with console.warn", () => {
				const consoleSpy = vi
					.spyOn(console, "warn")
					.mockImplementation(() => {});

				log("test", "warn", { event: "test.warn" });

				expect(consoleSpy).toHaveBeenCalledWith(
					"[test]",
					expect.objectContaining({
						service: "test",
						event: "test.warn",
					}),
				);
				consoleSpy.mockRestore();
			});

			it("logs error events with console.error", () => {
				const consoleSpy = vi
					.spyOn(console, "error")
					.mockImplementation(() => {});

				log("test", "error", { event: "test.error" });

				expect(consoleSpy).toHaveBeenCalledWith(
					"[test]",
					expect.objectContaining({
						service: "test",
						event: "test.error",
					}),
				);
				consoleSpy.mockRestore();
			});
		});

		describe("context enrichment", () => {
			it("enriches logs with requestId from context", () => {
				const consoleSpy = vi
					.spyOn(console, "log")
					.mockImplementation(() => {});

				const ctx = createRequestContext({
					service: "test",
					requestId: "ctx-req-id",
				});

				runWithContext(ctx, () => {
					log("test", "info", { event: "test.event" });
				});

				expect(consoleSpy).toHaveBeenCalledWith(
					"[test]",
					expect.objectContaining({
						requestId: "ctx-req-id",
					}),
				);
				consoleSpy.mockRestore();
			});

			it("enriches logs with userId from context", () => {
				const consoleSpy = vi
					.spyOn(console, "log")
					.mockImplementation(() => {});

				const ctx = createRequestContext({
					service: "test",
					userId: "user-123",
				});

				runWithContext(ctx, () => {
					log("test", "info", { event: "test.event" });
				});

				expect(consoleSpy).toHaveBeenCalledWith(
					"[test]",
					expect.objectContaining({
						userId: "user-123",
					}),
				);
				consoleSpy.mockRestore();
			});

			it("enriches logs with chatId from context", () => {
				const consoleSpy = vi
					.spyOn(console, "log")
					.mockImplementation(() => {});

				const ctx = createRequestContext({
					service: "test",
					chatId: "chat-456",
				});

				runWithContext(ctx, () => {
					log("test", "info", { event: "test.event" });
				});

				expect(consoleSpy).toHaveBeenCalledWith(
					"[test]",
					expect.objectContaining({
						chatId: "chat-456",
					}),
				);
				consoleSpy.mockRestore();
			});

			it("field values override context values when both provided", () => {
				const consoleSpy = vi
					.spyOn(console, "log")
					.mockImplementation(() => {});

				const ctx = createRequestContext({
					service: "test",
					requestId: "ctx-req-id",
					userId: "ctx-user",
				});

				runWithContext(ctx, () => {
					log("test", "info", {
						event: "test.event",
						requestId: "field-req-id",
						userId: "field-user",
					});
				});

				// Field values should override context values
				expect(consoleSpy).toHaveBeenCalledWith(
					"[test]",
					expect.objectContaining({
						requestId: "field-req-id",
						userId: "field-user",
					}),
				);
				consoleSpy.mockRestore();
			});
		});

		describe("Sentry integration", () => {
			it("calls Sentry.withScope for error level", () => {
				vi.spyOn(console, "error").mockImplementation(() => {});

				log("test", "error", { event: "test.error" });

				expect(mockWithScope).toHaveBeenCalled();
			});

			it("sets service and event tags", () => {
				vi.spyOn(console, "error").mockImplementation(() => {});

				log("test", "error", { event: "test.error" });

				expect(mockSetTag).toHaveBeenCalledWith("service", "test");
				expect(mockSetTag).toHaveBeenCalledWith("event", "test.error");
			});

			it("sets request_id tag when available", () => {
				vi.spyOn(console, "error").mockImplementation(() => {});

				const ctx = createRequestContext({
					service: "test",
					requestId: "req-123",
				});

				runWithContext(ctx, () => {
					log("test", "error", { event: "test.error" });
				});

				expect(mockSetTag).toHaveBeenCalledWith("request_id", "req-123");
			});

			it("sets user_id tag when available", () => {
				vi.spyOn(console, "error").mockImplementation(() => {});

				const ctx = createRequestContext({
					service: "test",
					userId: "user-123",
				});

				runWithContext(ctx, () => {
					log("test", "error", { event: "test.error" });
				});

				expect(mockSetTag).toHaveBeenCalledWith("user_id", "user-123");
			});

			it("sets chat_id tag when available", () => {
				vi.spyOn(console, "error").mockImplementation(() => {});

				const ctx = createRequestContext({
					service: "test",
					chatId: "chat-456",
				});

				runWithContext(ctx, () => {
					log("test", "error", { event: "test.error" });
				});

				expect(mockSetTag).toHaveBeenCalledWith("chat_id", "chat-456");
			});

			it("sets direction tag when provided", () => {
				vi.spyOn(console, "error").mockImplementation(() => {});

				log("test", "error", { event: "test.error", direction: "inbound" });

				expect(mockSetTag).toHaveBeenCalledWith("direction", "inbound");
			});

			it("captures exception when exception field is an Error", () => {
				vi.spyOn(console, "error").mockImplementation(() => {});
				const testError = new Error("Test exception");

				log("test", "error", { event: "test.error", exception: testError });

				expect(mockCaptureException).toHaveBeenCalledWith(testError);
			});

			it("captures message when exception is not an Error", () => {
				vi.spyOn(console, "error").mockImplementation(() => {});

				log("test", "error", {
					event: "test.error",
					error: "Something went wrong",
				});

				expect(mockCaptureMessage).toHaveBeenCalledWith(
					"Something went wrong",
					"error",
				);
			});

			it("captures event as message when no error field", () => {
				vi.spyOn(console, "error").mockImplementation(() => {});

				log("test", "error", { event: "test.error.event" });

				expect(mockCaptureMessage).toHaveBeenCalledWith(
					"test.error.event",
					"error",
				);
			});

			it("does not call Sentry for non-error levels", () => {
				vi.spyOn(console, "log").mockImplementation(() => {});
				vi.spyOn(console, "warn").mockImplementation(() => {});

				log("test", "info", { event: "test.info" });
				log("test", "warn", { event: "test.warn" });
				log("test", "debug", { event: "test.debug" });

				expect(mockWithScope).not.toHaveBeenCalled();
			});
		});

		describe("error handling", () => {
			it("handles logging errors gracefully", () => {
				const errorSpy = vi
					.spyOn(console, "error")
					.mockImplementation(() => {});
				const logSpy = vi.spyOn(console, "log").mockImplementation(() => {
					throw new Error("Logging failed");
				});

				// Should not throw
				log("test", "info", { event: "test.event" });

				expect(errorSpy).toHaveBeenCalledWith(
					"[test] logging failed",
					expect.objectContaining({
						loggingError: "Logging failed",
						originalEvent: "test.event",
					}),
				);

				logSpy.mockRestore();
				errorSpy.mockRestore();
			});

			it("handles Sentry errors gracefully", () => {
				const errorSpy = vi
					.spyOn(console, "error")
					.mockImplementation(() => {});
				mockWithScope.mockImplementationOnce(() => {
					throw new Error("Sentry failed");
				});

				// Should not throw
				log("test", "error", { event: "test.error" });

				expect(errorSpy).toHaveBeenCalledWith(
					"[test] sentry capture failed",
					expect.objectContaining({
						sentryError: "Sentry failed",
						originalEvent: "test.error",
					}),
				);

				errorSpy.mockRestore();
			});
		});
	});

	describe("createLogger", () => {
		it("creates a logger with all level methods", () => {
			const logger = createLogger("test-service");

			expect(logger.debug).toBeInstanceOf(Function);
			expect(logger.info).toBeInstanceOf(Function);
			expect(logger.warn).toBeInstanceOf(Function);
			expect(logger.error).toBeInstanceOf(Function);
		});

		it("logs with the correct service name", () => {
			const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
			const logger = createLogger("my-service");

			logger.info({ event: "test.event" });

			expect(consoleSpy).toHaveBeenCalledWith(
				"[my-service]",
				expect.objectContaining({
					service: "my-service",
				}),
			);
			consoleSpy.mockRestore();
		});

		it("debug method logs at debug level", () => {
			const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
			const logger = createLogger("test");

			logger.debug({ event: "test.debug" });

			expect(consoleSpy).toHaveBeenCalled();
			consoleSpy.mockRestore();
		});

		it("info method logs at info level", () => {
			const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
			const logger = createLogger("test");

			logger.info({ event: "test.info" });

			expect(consoleSpy).toHaveBeenCalled();
			consoleSpy.mockRestore();
		});

		it("warn method logs at warn level", () => {
			const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
			const logger = createLogger("test");

			logger.warn({ event: "test.warn" });

			expect(consoleSpy).toHaveBeenCalled();
			consoleSpy.mockRestore();
		});

		it("error method logs at error level", () => {
			const consoleSpy = vi
				.spyOn(console, "error")
				.mockImplementation(() => {});
			const logger = createLogger("test");

			logger.error({ event: "test.error" });

			expect(consoleSpy).toHaveBeenCalled();
			consoleSpy.mockRestore();
		});
	});
});
