import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	logWhatsAppEvent,
	setWhatsAppSpanAttributes,
} from "@/app/api/whatsapp/observability";

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

describe("logWhatsAppEvent", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("log levels", () => {
		it("logs info events with console.log", () => {
			const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

			logWhatsAppEvent("info", { event: "test.info" });

			expect(consoleSpy).toHaveBeenCalledWith(
				"[whatsapp]",
				expect.objectContaining({
					service: "whatsapp",
					event: "test.info",
				}),
			);
			consoleSpy.mockRestore();
		});

		it("logs warn events with console.warn", () => {
			const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

			logWhatsAppEvent("warn", { event: "test.warn" });

			expect(consoleSpy).toHaveBeenCalledWith(
				"[whatsapp]",
				expect.objectContaining({
					service: "whatsapp",
					event: "test.warn",
				}),
			);
			consoleSpy.mockRestore();
		});

		it("logs error events with console.error", () => {
			const consoleSpy = vi
				.spyOn(console, "error")
				.mockImplementation(() => {});

			logWhatsAppEvent("error", { event: "test.error" });

			expect(consoleSpy).toHaveBeenCalledWith(
				"[whatsapp]",
				expect.objectContaining({
					service: "whatsapp",
					event: "test.error",
				}),
			);
			consoleSpy.mockRestore();
		});
	});

	describe("Sentry integration for error level", () => {
		it("calls Sentry.withScope for error level", () => {
			vi.spyOn(console, "error").mockImplementation(() => {});

			logWhatsAppEvent("error", { event: "test.error" });

			expect(mockWithScope).toHaveBeenCalled();
		});

		it("sets service and event tags", () => {
			vi.spyOn(console, "error").mockImplementation(() => {});

			logWhatsAppEvent("error", { event: "test.error" });

			expect(mockSetTag).toHaveBeenCalledWith("service", "whatsapp");
			expect(mockSetTag).toHaveBeenCalledWith("whatsapp.event", "test.error");
		});

		it("sets direction tag when provided", () => {
			vi.spyOn(console, "error").mockImplementation(() => {});

			logWhatsAppEvent("error", { event: "test.error", direction: "inbound" });

			expect(mockSetTag).toHaveBeenCalledWith("whatsapp.direction", "inbound");
		});

		it("sets status tag when provided", () => {
			vi.spyOn(console, "error").mockImplementation(() => {});

			logWhatsAppEvent("error", { event: "test.error", status: "failed" });

			expect(mockSetTag).toHaveBeenCalledWith("whatsapp.status", "failed");
		});

		it("sets messageSid tag when provided", () => {
			vi.spyOn(console, "error").mockImplementation(() => {});

			logWhatsAppEvent("error", { event: "test.error", messageSid: "SM123" });

			expect(mockSetTag).toHaveBeenCalledWith("whatsapp.message_sid", "SM123");
		});

		it("sets waId tag when provided", () => {
			vi.spyOn(console, "error").mockImplementation(() => {});

			logWhatsAppEvent("error", { event: "test.error", waId: "123456" });

			expect(mockSetTag).toHaveBeenCalledWith("whatsapp.wa_id", "123456");
		});

		it("sets chatId tag when provided", () => {
			vi.spyOn(console, "error").mockImplementation(() => {});

			logWhatsAppEvent("error", {
				event: "test.error",
				chatId: "chat-123",
			});

			expect(mockSetTag).toHaveBeenCalledWith("whatsapp.chat_id", "chat-123");
		});

		it("sets requestUrl extra when provided", () => {
			vi.spyOn(console, "error").mockImplementation(() => {});

			logWhatsAppEvent("error", {
				event: "test.error",
				requestUrl: "https://example.com/webhook",
			});

			expect(mockSetExtra).toHaveBeenCalledWith(
				"requestUrl",
				"https://example.com/webhook",
			);
		});

		it("sets fromNumber extra when provided", () => {
			vi.spyOn(console, "error").mockImplementation(() => {});

			logWhatsAppEvent("error", {
				event: "test.error",
				fromNumber: "+15551234567",
			});

			expect(mockSetExtra).toHaveBeenCalledWith("fromNumber", "+15551234567");
		});

		it("sets toNumber extra when provided", () => {
			vi.spyOn(console, "error").mockImplementation(() => {});

			logWhatsAppEvent("error", {
				event: "test.error",
				toNumber: "+15559876543",
			});

			expect(mockSetExtra).toHaveBeenCalledWith("toNumber", "+15559876543");
		});

		it("sets details extra when provided", () => {
			vi.spyOn(console, "error").mockImplementation(() => {});

			logWhatsAppEvent("error", {
				event: "test.error",
				details: { key: "value" },
			});

			expect(mockSetExtra).toHaveBeenCalledWith("details", { key: "value" });
		});

		it("captures exception when exception field is an Error", () => {
			vi.spyOn(console, "error").mockImplementation(() => {});
			const testError = new Error("Test exception");

			logWhatsAppEvent("error", {
				event: "test.error",
				exception: testError,
			});

			expect(mockCaptureException).toHaveBeenCalledWith(testError);
		});

		it("captures message when exception is not an Error", () => {
			vi.spyOn(console, "error").mockImplementation(() => {});

			logWhatsAppEvent("error", {
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

			logWhatsAppEvent("error", { event: "test.error.event" });

			expect(mockCaptureMessage).toHaveBeenCalledWith(
				"test.error.event",
				"error",
			);
		});

		it("does not call Sentry for info level", () => {
			vi.spyOn(console, "log").mockImplementation(() => {});

			logWhatsAppEvent("info", { event: "test.info" });

			expect(mockWithScope).not.toHaveBeenCalled();
		});

		it("does not call Sentry for warn level", () => {
			vi.spyOn(console, "warn").mockImplementation(() => {});

			logWhatsAppEvent("warn", { event: "test.warn" });

			expect(mockWithScope).not.toHaveBeenCalled();
		});
	});

	describe("error handling", () => {
		it("handles logging errors gracefully", () => {
			const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
			const logSpy = vi.spyOn(console, "log").mockImplementation(() => {
				throw new Error("Logging failed");
			});

			// Should not throw
			logWhatsAppEvent("info", { event: "test.event" });

			expect(errorSpy).toHaveBeenCalledWith(
				"[whatsapp] logging failed",
				expect.objectContaining({
					loggingError: "Logging failed",
					originalEvent: "test.event",
				}),
			);

			logSpy.mockRestore();
			errorSpy.mockRestore();
		});

		it("handles non-Error logging failures", () => {
			const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
			const logSpy = vi.spyOn(console, "log").mockImplementation(() => {
				throw "string error";
			});

			logWhatsAppEvent("info", { event: "test.event" });

			expect(errorSpy).toHaveBeenCalledWith(
				"[whatsapp] logging failed",
				expect.objectContaining({
					loggingError: "string error",
					originalEvent: "test.event",
				}),
			);

			logSpy.mockRestore();
			errorSpy.mockRestore();
		});

		it("handles Sentry errors gracefully", () => {
			const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
			mockWithScope.mockImplementationOnce(() => {
				throw new Error("Sentry failed");
			});

			// Should not throw
			logWhatsAppEvent("error", { event: "test.error" });

			expect(errorSpy).toHaveBeenCalledWith(
				"[whatsapp] sentry capture failed",
				expect.objectContaining({
					sentryError: "Sentry failed",
					originalEvent: "test.error",
				}),
			);

			errorSpy.mockRestore();
		});

		it("handles non-Error Sentry failures", () => {
			const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
			mockWithScope.mockImplementationOnce(() => {
				throw "sentry string error";
			});

			logWhatsAppEvent("error", { event: "test.error" });

			expect(errorSpy).toHaveBeenCalledWith(
				"[whatsapp] sentry capture failed",
				expect.objectContaining({
					sentryError: "sentry string error",
					originalEvent: "test.error",
				}),
			);

			errorSpy.mockRestore();
		});
	});
});

describe("setWhatsAppSpanAttributes", () => {
	const createMockSpan = () => ({
		setAttribute: vi.fn(),
	});

	it("sets event attribute", () => {
		const span = createMockSpan();
		setWhatsAppSpanAttributes(span as never, { event: "test.event" });
		expect(span.setAttribute).toHaveBeenCalledWith(
			"whatsapp.event",
			"test.event",
		);
	});

	it("sets direction attribute", () => {
		const span = createMockSpan();
		setWhatsAppSpanAttributes(span as never, { direction: "inbound" });
		expect(span.setAttribute).toHaveBeenCalledWith(
			"whatsapp.direction",
			"inbound",
		);
	});

	it("sets messageSid attribute", () => {
		const span = createMockSpan();
		setWhatsAppSpanAttributes(span as never, { messageSid: "SM123" });
		expect(span.setAttribute).toHaveBeenCalledWith(
			"whatsapp.message_sid",
			"SM123",
		);
	});

	it("sets waId attribute", () => {
		const span = createMockSpan();
		setWhatsAppSpanAttributes(span as never, { waId: "123456" });
		expect(span.setAttribute).toHaveBeenCalledWith("whatsapp.wa_id", "123456");
	});

	it("sets chatId attribute", () => {
		const span = createMockSpan();
		setWhatsAppSpanAttributes(span as never, { chatId: "chat-123" });
		expect(span.setAttribute).toHaveBeenCalledWith(
			"whatsapp.chat_id",
			"chat-123",
		);
	});

	it("sets requestUrl attribute", () => {
		const span = createMockSpan();
		setWhatsAppSpanAttributes(span as never, {
			requestUrl: "https://example.com",
		});
		expect(span.setAttribute).toHaveBeenCalledWith(
			"whatsapp.request_url",
			"https://example.com",
		);
	});

	it("sets fromNumber attribute", () => {
		const span = createMockSpan();
		setWhatsAppSpanAttributes(span as never, { fromNumber: "+15551234567" });
		expect(span.setAttribute).toHaveBeenCalledWith(
			"whatsapp.from_number",
			"+15551234567",
		);
	});

	it("sets toNumber attribute", () => {
		const span = createMockSpan();
		setWhatsAppSpanAttributes(span as never, { toNumber: "+15559876543" });
		expect(span.setAttribute).toHaveBeenCalledWith(
			"whatsapp.to_number",
			"+15559876543",
		);
	});

	it("sets status attribute", () => {
		const span = createMockSpan();
		setWhatsAppSpanAttributes(span as never, { status: "sent" });
		expect(span.setAttribute).toHaveBeenCalledWith("whatsapp.status", "sent");
	});

	it("sets error attribute", () => {
		const span = createMockSpan();
		setWhatsAppSpanAttributes(span as never, { error: "Something failed" });
		expect(span.setAttribute).toHaveBeenCalledWith(
			"whatsapp.error",
			"Something failed",
		);
	});

	it("only sets provided attributes", () => {
		const span = createMockSpan();
		setWhatsAppSpanAttributes(span as never, { event: "test" });
		expect(span.setAttribute).toHaveBeenCalledTimes(1);
	});

	it("sets multiple attributes when provided", () => {
		const span = createMockSpan();
		setWhatsAppSpanAttributes(span as never, {
			event: "test.event",
			direction: "outbound",
			messageSid: "SM123",
			status: "sent",
		});
		// 5 calls: request_id (using messageSid as fallback), event, direction, messageSid, status
		expect(span.setAttribute).toHaveBeenCalledTimes(5);
	});

	it("does not set undefined attributes", () => {
		const span = createMockSpan();
		setWhatsAppSpanAttributes(span as never, {
			event: undefined,
			direction: undefined,
		});
		expect(span.setAttribute).not.toHaveBeenCalled();
	});
});
