import twilio, { RestException } from "twilio";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	chunkMessageByNewlines,
	createTwilioClient,
	getTwilioErrorMetadata,
	type SendMessageParams,
	sendTypingIndicator,
	sendWhatsAppMessage,
	sendWhatsAppMessageWithRetry,
	type TwilioClient,
	validateTwilioRequest,
} from "@/app/api/whatsapp/twilio";
import type { IncomingMessage } from "@/app/api/whatsapp/types";

// Mock the rate limiter
vi.mock("@/lib/rate-limiter", () => ({
	whatsappRateLimiter: {
		acquire: vi.fn().mockResolvedValue(undefined),
	},
}));

// Mock twilio module - only mock the constructor and validateRequest
vi.mock("twilio", async (importOriginal) => {
	const actual = await importOriginal<typeof import("twilio")>();
	const mockValidateRequest = vi.fn().mockReturnValue(true);
	const mockTwilioConstructor = vi.fn(() => ({
		messages: { create: vi.fn() },
		conversations: { v1: { conversations: vi.fn() } },
		request: vi.fn(),
	})) as unknown as typeof actual.default;
	(mockTwilioConstructor as unknown as { validateRequest: typeof mockValidateRequest }).validateRequest = mockValidateRequest;
	return {
		...actual,
		default: mockTwilioConstructor,
		RestException: actual.RestException,
	};
});

// Mock config
vi.mock("@/lib/config/server", () => ({
	getTwilioConfig: vi.fn(() => ({
		accountSid: "AC123",
		authToken: "token",
		whatsappFrom: "+15551234567",
		messagingServiceSid: undefined,
		whatsappWebhookUrl: "https://example.com/api/whatsapp",
		conversationsAgentIdentity: "agent-identity",
	})),
	vercelEnv: "test",
}));

describe("chunkMessageByNewlines", () => {
	const MAX_LENGTH = 1600;

	describe("messages under limit", () => {
		it("returns no chunks for empty message", () => {
			const result = chunkMessageByNewlines("", MAX_LENGTH);
			expect(result).toEqual([]);
		});

		it("returns single chunk for message under limit", () => {
			const message = "Hello, this is a short message.";
			const result = chunkMessageByNewlines(message, MAX_LENGTH);
			expect(result).toEqual([message]);
		});

		it("returns single chunk for message exactly at limit", () => {
			const message = "a".repeat(MAX_LENGTH);
			const result = chunkMessageByNewlines(message, MAX_LENGTH);
			expect(result).toEqual([message]);
		});

		it("returns single chunk for multi-line message under limit", () => {
			const message = "Line 1\nLine 2\nLine 3";
			const result = chunkMessageByNewlines(message, MAX_LENGTH);
			expect(result).toEqual([message]);
		});
	});

	describe("message chunking", () => {
		it("splits message on newline boundaries", () => {
			const line1 = "a".repeat(1000);
			const line2 = "b".repeat(1000);
			const message = `${line1}\n${line2}`;

			const result = chunkMessageByNewlines(message, MAX_LENGTH);

			expect(result).toHaveLength(2);
			expect(result[0]).toBe(line1);
			expect(result[1]).toBe(line2);
		});

		it("combines lines that fit together (minimizes message count)", () => {
			// This tests the optimization case: [700, 800, 900] should produce 2 messages
			const line1 = "a".repeat(700);
			const line2 = "b".repeat(800);
			const line3 = "c".repeat(900);
			const message = `${line1}\n${line2}\n${line3}`;

			const result = chunkMessageByNewlines(message, MAX_LENGTH);

			// line1 (700) + \n + line2 (800) = 1501 chars - fits in first chunk
			// line3 (900) goes in second chunk
			expect(result).toHaveLength(2);
			expect(result[0]).toBe(`${line1}\n${line2}`);
			expect(result[0]?.length).toBe(1501);
			expect(result[1]).toBe(line3);
			expect(result[1]?.length).toBe(900);
		});

		it("greedily packs lines to minimize chunks", () => {
			// 5 lines of 400 chars each
			// Line 0: 400
			// Line 0+1: 400 + 1 + 400 = 801
			// Line 0+1+2: 801 + 1 + 400 = 1202
			// Line 0+1+2+3: 1202 + 1 + 400 = 1603 > 1600, doesn't fit
			// So first chunk has 3 lines (1202 chars)
			// Second chunk: line 3 (400) + 1 + line 4 (400) = 801 chars
			const lines = Array.from({ length: 5 }, (_, i) =>
				String.fromCharCode(97 + i).repeat(400),
			);
			const message = lines.join("\n");

			const result = chunkMessageByNewlines(message, MAX_LENGTH);

			expect(result).toHaveLength(2);
			expect(result[0]).toBe(`${lines[0]}\n${lines[1]}\n${lines[2]}`);
			expect(result[0]?.length).toBe(1202);
			expect(result[1]).toBe(`${lines[3]}\n${lines[4]}`);
			expect(result[1]?.length).toBe(801);
		});

		it("handles single line exceeding limit", () => {
			const longLine = "a".repeat(2000);
			const result = chunkMessageByNewlines(longLine, MAX_LENGTH);

			// Single line over limit is kept as one chunk (Twilio handles truncation)
			expect(result).toHaveLength(1);
			expect(result[0]).toBe(longLine);
		});

		it("handles mixed short and long lines", () => {
			const shortLine = "short";
			const longLine = "a".repeat(2000);
			const anotherShort = "also short";
			const message = `${shortLine}\n${longLine}\n${anotherShort}`;

			const result = chunkMessageByNewlines(message, MAX_LENGTH);

			expect(result).toHaveLength(3);
			expect(result[0]).toBe(shortLine);
			expect(result[1]).toBe(longLine);
			expect(result[2]).toBe(anotherShort);
		});

		it("handles message with no newlines exceeding limit", () => {
			const message = "a".repeat(2000);
			const result = chunkMessageByNewlines(message, MAX_LENGTH);

			// No newlines to split on, so it's one chunk
			expect(result).toHaveLength(1);
			expect(result[0]).toBe(message);
		});
	});

	describe("edge cases", () => {
		it("handles consecutive newlines", () => {
			const message = "line1\n\n\nline2";
			const result = chunkMessageByNewlines(message, MAX_LENGTH);

			expect(result).toEqual([message]);
		});

		it("handles message ending with newline", () => {
			const message = "line1\nline2\n";
			const result = chunkMessageByNewlines(message, MAX_LENGTH);

			expect(result).toEqual([message]);
		});

		it("handles message starting with newline", () => {
			const message = "\nline1\nline2";
			const result = chunkMessageByNewlines(message, MAX_LENGTH);

			expect(result).toEqual([message]);
		});

		it("preserves exact content across chunks", () => {
			const line1 = "First line with some content";
			const line2 = "a".repeat(1600);
			const line3 = "Third line here";
			const message = `${line1}\n${line2}\n${line3}`;

			const result = chunkMessageByNewlines(message, MAX_LENGTH);

			// Reconstruct and verify
			const reconstructed = result.join("\n");
			expect(reconstructed).toBe(message);
		});

		it("uses custom max length", () => {
			const message = "abc\ndef\nghi";
			const result = chunkMessageByNewlines(message, 7);

			// "abc\ndef" = 7 chars, "ghi" = 3 chars
			expect(result).toHaveLength(2);
			expect(result[0]).toBe("abc\ndef");
			expect(result[1]).toBe("ghi");
		});
	});
});

describe("getTwilioErrorMetadata", () => {
	it("returns undefined for non-RestException errors", () => {
		expect(getTwilioErrorMetadata(new Error("Regular error"))).toBeUndefined();
		expect(getTwilioErrorMetadata("string error")).toBeUndefined();
		expect(getTwilioErrorMetadata(null)).toBeUndefined();
		expect(getTwilioErrorMetadata(undefined)).toBeUndefined();
		expect(getTwilioErrorMetadata({})).toBeUndefined();
	});

	it("extracts metadata from RestException", () => {
		const mockResponse = {
			statusCode: 400,
			body: JSON.stringify({ code: 21211, message: "Invalid phone number" }),
		};
		const restException = new RestException(mockResponse as never);

		const metadata = getTwilioErrorMetadata(restException);

		expect(metadata).toBeDefined();
		expect(metadata?.status).toBe(400);
		expect(metadata?.code).toBe(21211);
	});

	it("extracts moreInfo from RestException when available", () => {
		const mockResponse = {
			statusCode: 400,
			body: JSON.stringify({
				code: 21211,
				message: "Invalid phone number",
				more_info: "https://www.twilio.com/docs/errors/21211",
			}),
		};
		const restException = new RestException(mockResponse as never);

		const metadata = getTwilioErrorMetadata(restException);

		expect(metadata).toBeDefined();
		expect(metadata?.moreInfo).toBe("https://www.twilio.com/docs/errors/21211");
	});

	it("extracts details from RestException when available", () => {
		const mockResponse = {
			statusCode: 400,
			body: JSON.stringify({
				code: 21211,
				message: "Invalid phone number",
				details: { field: "To", issue: "invalid format" },
			}),
		};
		const restException = new RestException(mockResponse as never);

		const metadata = getTwilioErrorMetadata(restException);

		expect(metadata).toBeDefined();
		expect(metadata?.details).toEqual({ field: "To", issue: "invalid format" });
	});

	it("handles RestException with minimal fields", () => {
		const mockResponse = {
			statusCode: 500,
			body: JSON.stringify({ message: "Internal server error" }),
		};
		const restException = new RestException(mockResponse as never);

		const metadata = getTwilioErrorMetadata(restException);

		expect(metadata).toBeDefined();
		expect(metadata?.status).toBe(500);
		expect(metadata?.code).toBeUndefined();
		expect(metadata?.moreInfo).toBeUndefined();
		expect(metadata?.details).toBeUndefined();
	});

	it("handles RestException with non-object details", () => {
		const mockResponse = {
			statusCode: 400,
			body: JSON.stringify({
				code: 21211,
				message: "Error",
				details: "string details",
			}),
		};
		const restException = new RestException(mockResponse as never);

		const metadata = getTwilioErrorMetadata(restException);

		expect(metadata).toBeDefined();
		// Non-object details should be filtered out
		expect(metadata?.details).toBeUndefined();
	});
});

describe("sendWhatsAppMessageWithRetry", () => {
	const createMockClient = (
		createFn: () => Promise<{ sid: string; status: string }>,
	): TwilioClient =>
		({
			messages: {
				create: createFn,
			},
		}) as unknown as TwilioClient;

	beforeEach(() => {
		vi.clearAllMocks();
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("throws error for empty message", async () => {
		const client = createMockClient(() =>
			Promise.resolve({ sid: "SM123", status: "sent" }),
		);

		const params: SendMessageParams = {
			client,
			to: "+15559876543",
			response: "",
		};

		await expect(sendWhatsAppMessageWithRetry(params)).rejects.toThrow(
			"Cannot send empty message",
		);
	});

	it("throws error for whitespace-only message", async () => {
		const client = createMockClient(() =>
			Promise.resolve({ sid: "SM123", status: "sent" }),
		);

		const params: SendMessageParams = {
			client,
			to: "+15559876543",
			response: "   \n\t  ",
		};

		await expect(sendWhatsAppMessageWithRetry(params)).rejects.toThrow(
			"Cannot send empty message",
		);
	});

	it("sends a single message successfully", async () => {
		const mockCreate = vi
			.fn()
			.mockResolvedValue({ sid: "SM123", status: "sent" });
		const client = createMockClient(mockCreate);

		const params: SendMessageParams = {
			client,
			to: "+15559876543",
			response: "Hello, world!",
		};

		const resultPromise = sendWhatsAppMessageWithRetry(params);
		await vi.runAllTimersAsync();
		const result = await resultPromise;

		expect(result.sid).toBe("SM123");
		expect(result.status).toBe("sent");
		expect(mockCreate).toHaveBeenCalledTimes(1);
	});

	it("sends chunked messages for long content", async () => {
		const mockCreate = vi
			.fn()
			.mockResolvedValue({ sid: "SM123", status: "sent" });
		const client = createMockClient(mockCreate);

		// Create a message that will be chunked (over 1600 chars)
		const line1 = "a".repeat(1000);
		const line2 = "b".repeat(1000);
		const params: SendMessageParams = {
			client,
			to: "+15559876543",
			response: `${line1}\n${line2}`,
		};

		const resultPromise = sendWhatsAppMessageWithRetry(params);
		await vi.runAllTimersAsync();
		const result = await resultPromise;

		expect(result.sid).toBe("SM123");
		// Should be called twice for two chunks
		expect(mockCreate).toHaveBeenCalledTimes(2);
	});

	it("includes correlation data in calls", async () => {
		const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
		const mockCreate = vi
			.fn()
			.mockResolvedValue({ sid: "SM123", status: "sent" });
		const client = createMockClient(mockCreate);

		const params: SendMessageParams = {
			client,
			to: "+15559876543",
			response: "Hello",
			correlation: {
				messageSid: "SM-incoming",
				waId: "123456",
				chatId: "chat-123",
			},
		};

		const resultPromise = sendWhatsAppMessageWithRetry(params);
		await vi.runAllTimersAsync();
		await resultPromise;

		expect(mockCreate).toHaveBeenCalled();
		expect(logSpy).toHaveBeenCalledWith(
			"[whatsapp]",
			expect.objectContaining({
				event: "whatsapp.outbound.sent",
				messageSid: "SM-incoming",
				waId: "123456",
				chatId: "chat-123",
			}),
		);

		logSpy.mockRestore();
	});

	it("retries on transient failures and succeeds", async () => {
		const mockCreate = vi
			.fn()
			.mockRejectedValueOnce(
				new RestException({
					statusCode: 503,
					body: JSON.stringify({ message: "Service unavailable" }),
				} as never),
			)
			.mockResolvedValue({ sid: "SM123", status: "sent" });
		const client = createMockClient(mockCreate);

		const params: SendMessageParams = {
			client,
			to: "+15559876543",
			response: "Hello",
		};

		const resultPromise = sendWhatsAppMessageWithRetry(params);
		await vi.runAllTimersAsync();
		const result = await resultPromise;

		expect(result.sid).toBe("SM123");
		expect(mockCreate).toHaveBeenCalledTimes(2);
	});

	it("does not retry on non-retryable errors", async () => {
		const mockCreate = vi.fn().mockRejectedValue(
			new RestException({
				statusCode: 400,
				body: JSON.stringify({ message: "Bad request" }),
			} as never),
		);
		const client = createMockClient(mockCreate);

		const params: SendMessageParams = {
			client,
			to: "+15559876543",
			response: "Hello",
		};

		const resultPromise = sendWhatsAppMessageWithRetry(params);
		resultPromise.catch(() => {}); // Prevent unhandled rejection warning

		await vi.runAllTimersAsync();
		await expect(resultPromise).rejects.toThrow();
		// Only one attempt for non-retryable error
		expect(mockCreate).toHaveBeenCalledTimes(1);
	});

	it("logs chunking info for multi-chunk messages", async () => {
		const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
		const mockCreate = vi
			.fn()
			.mockResolvedValue({ sid: "SM123", status: "sent" });
		const client = createMockClient(mockCreate);

		const line1 = "a".repeat(1000);
		const line2 = "b".repeat(1000);
		const params: SendMessageParams = {
			client,
			to: "+15559876543",
			response: `${line1}\n${line2}`,
			correlation: { messageSid: "SM-test" },
		};

		const resultPromise = sendWhatsAppMessageWithRetry(params);
		await vi.runAllTimersAsync();
		await resultPromise;

		expect(logSpy).toHaveBeenCalledWith(
			"[whatsapp]",
			expect.objectContaining({
				event: "whatsapp.outbound.chunking",
			}),
		);

		logSpy.mockRestore();
	});

	it("logs retry warnings when retries occur", async () => {
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
		const mockCreate = vi
			.fn()
			.mockRejectedValueOnce(
				new RestException({
					statusCode: 500,
					body: JSON.stringify({ message: "Server error" }),
				} as never),
			)
			.mockResolvedValue({ sid: "SM123", status: "sent" });
		const client = createMockClient(mockCreate);

		const params: SendMessageParams = {
			client,
			to: "+15559876543",
			response: "Hello",
		};

		const resultPromise = sendWhatsAppMessageWithRetry(params);
		await vi.runAllTimersAsync();
		await resultPromise;

		expect(warnSpy).toHaveBeenCalledWith(
			"[whatsapp]",
			expect.objectContaining({
				event: "whatsapp.outbound.send_retried",
			}),
		);

		warnSpy.mockRestore();
		logSpy.mockRestore();
	});

	it("handles rate limit errors from rate limiter", async () => {
		const { whatsappRateLimiter } = await import("@/lib/rate-limiter");
		vi.mocked(whatsappRateLimiter.acquire).mockRejectedValueOnce(
			new Error("Rate limit exceeded"),
		);

		const mockCreate = vi
			.fn()
			.mockResolvedValue({ sid: "SM123", status: "sent" });
		const client = createMockClient(mockCreate);

		const params: SendMessageParams = {
			client,
			to: "+15559876543",
			response: "Hello",
		};

		const resultPromise = sendWhatsAppMessageWithRetry(params);
		resultPromise.catch(() => {}); // Prevent unhandled rejection warning

		await vi.runAllTimersAsync();
		await expect(resultPromise).rejects.toThrow("Rate limit exceeded");
		expect(mockCreate).not.toHaveBeenCalled();
	});

	it("retries on network errors (ECONNRESET)", async () => {
		const networkError = new Error("ECONNRESET");
		const mockCreate = vi
			.fn()
			.mockRejectedValueOnce(networkError)
			.mockResolvedValue({ sid: "SM123", status: "sent" });
		const client = createMockClient(mockCreate);

		const params: SendMessageParams = {
			client,
			to: "+15559876543",
			response: "Hello",
		};

		const resultPromise = sendWhatsAppMessageWithRetry(params);
		await vi.runAllTimersAsync();
		const result = await resultPromise;

		expect(result.sid).toBe("SM123");
		expect(mockCreate).toHaveBeenCalledTimes(2);
	});

	it("does not retry on unknown error types", async () => {
		// Create an error that's not a RestException and not a network error
		const unknownError = { code: "UNKNOWN", message: "Unknown error" };
		const mockCreate = vi.fn().mockRejectedValue(unknownError);
		const client = createMockClient(mockCreate);

		const params: SendMessageParams = {
			client,
			to: "+15559876543",
			response: "Hello",
		};

		const resultPromise = sendWhatsAppMessageWithRetry(params);
		resultPromise.catch(() => {}); // Prevent unhandled rejection warning

		await vi.runAllTimersAsync();
		await expect(resultPromise).rejects.toEqual(unknownError);
		// Should only try once for unknown error types
		expect(mockCreate).toHaveBeenCalledTimes(1);
	});

	it("retries on 429 rate limit responses", async () => {
		const mockCreate = vi
			.fn()
			.mockRejectedValueOnce(
				new RestException({
					statusCode: 429,
					body: JSON.stringify({ message: "Too many requests" }),
				} as never),
			)
			.mockResolvedValue({ sid: "SM123", status: "sent" });
		const client = createMockClient(mockCreate);

		const params: SendMessageParams = {
			client,
			to: "+15559876543",
			response: "Hello",
		};

		const resultPromise = sendWhatsAppMessageWithRetry(params);
		await vi.runAllTimersAsync();
		const result = await resultPromise;

		expect(result.sid).toBe("SM123");
		expect(mockCreate).toHaveBeenCalledTimes(2);
	});
});

describe("validateTwilioRequest", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns true for valid signature", () => {
		vi.mocked(twilio.validateRequest).mockReturnValue(true);

		const result = validateTwilioRequest(
			"valid-signature",
			"https://example.com/webhook",
			{ Body: "Hello", From: "+15551234567" },
		);

		expect(result).toBe(true);
		expect(twilio.validateRequest).toHaveBeenCalledWith(
			"token",
			"valid-signature",
			"https://example.com/webhook",
			{ Body: "Hello", From: "+15551234567" },
		);
	});

	it("returns false for invalid signature", () => {
		vi.mocked(twilio.validateRequest).mockReturnValue(false);

		const result = validateTwilioRequest(
			"invalid-signature",
			"https://example.com/webhook",
			{ Body: "Hello" },
		);

		expect(result).toBe(false);
	});

	it("handles empty params object", () => {
		vi.mocked(twilio.validateRequest).mockReturnValue(true);

		const result = validateTwilioRequest(
			"signature",
			"https://example.com/webhook",
			{},
		);

		expect(result).toBe(true);
		expect(twilio.validateRequest).toHaveBeenCalledWith(
			"token",
			"signature",
			"https://example.com/webhook",
			{},
		);
	});
});

describe("createTwilioClient", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("creates a twilio client with correct config", () => {
		const client = createTwilioClient();

		expect(client).toBeDefined();
		expect(twilio).toHaveBeenCalledWith("AC123", "token", {
			autoRetry: true,
			maxRetries: 3,
		});
	});

	it("returns a client with messages API", () => {
		const client = createTwilioClient();

		expect(client.messages).toBeDefined();
	});
});

describe("sendTypingIndicator", () => {
	const createMockIncomingMessage = (
		overrides: Partial<IncomingMessage> = {},
	): IncomingMessage => ({
		MessageSid: "SM123",
		From: "whatsapp:+15551234567",
		To: "whatsapp:+15559876543",
		Body: "Hello",
		WaId: "15551234567",
		NumMedia: 0,
		ConversationSid: "CH123",
		...overrides,
	});

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("skips typing indicator when ConversationSid is missing", async () => {
		const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
		const payload = createMockIncomingMessage({ ConversationSid: undefined });
		const client = {} as TwilioClient;

		await sendTypingIndicator(client, payload);

		expect(logSpy).toHaveBeenCalledWith(
			"[whatsapp]",
			expect.objectContaining({
				event: "whatsapp.typing.skipped",
				details: { reason: "missing_conversation_sid" },
			}),
		);

		logSpy.mockRestore();
	});

	it("logs warning when agent participant is not found", async () => {
		const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
		const payload = createMockIncomingMessage();

		const mockParticipantsList = vi.fn().mockResolvedValue([
			{ identity: "other-agent", sid: "PA123" },
		]);
		const mockConversations = vi.fn().mockReturnValue({
			participants: { list: mockParticipantsList },
		});
		const client = {
			conversations: {
				v1: { conversations: mockConversations },
			},
		} as unknown as TwilioClient;

		await sendTypingIndicator(client, payload);

		expect(warnSpy).toHaveBeenCalledWith(
			"[whatsapp]",
			expect.objectContaining({
				event: "whatsapp.typing.agent_not_found",
			}),
		);

		warnSpy.mockRestore();
	});

	it("sends typing indicator successfully", async () => {
		const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
		const payload = createMockIncomingMessage();

		const mockRequest = vi.fn().mockResolvedValue({});
		const mockParticipantsList = vi.fn().mockResolvedValue([
			{ identity: "agent-identity", sid: "PA123" },
		]);
		const mockConversations = vi.fn().mockReturnValue({
			participants: { list: mockParticipantsList },
		});
		const client = {
			conversations: {
				v1: { conversations: mockConversations },
			},
			request: mockRequest,
		} as unknown as TwilioClient;

		await sendTypingIndicator(client, payload);

		expect(mockRequest).toHaveBeenCalledWith({
			method: "post",
			uri: "https://conversations.twilio.com/v1/Conversations/CH123/Participants/PA123/Typing",
		});
		expect(logSpy).toHaveBeenCalledWith(
			"[whatsapp]",
			expect.objectContaining({
				event: "whatsapp.typing.sent",
			}),
		);

		logSpy.mockRestore();
	});

	it("throws and records exception on error", async () => {
		const payload = createMockIncomingMessage();
		const error = new Error("Network error");

		const mockParticipantsList = vi.fn().mockRejectedValue(error);
		const mockConversations = vi.fn().mockReturnValue({
			participants: { list: mockParticipantsList },
		});
		const client = {
			conversations: {
				v1: { conversations: mockConversations },
			},
		} as unknown as TwilioClient;

		await expect(sendTypingIndicator(client, payload)).rejects.toThrow(
			"Network error",
		);
	});

	it("uses correlation IDs when provided", async () => {
		const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
		const payload = createMockIncomingMessage();
		const correlation = {
			messageSid: "SM-custom",
			waId: "custom-wa-id",
			chatId: "chat-456",
		};

		const mockRequest = vi.fn().mockResolvedValue({});
		const mockParticipantsList = vi.fn().mockResolvedValue([
			{ identity: "agent-identity", sid: "PA123" },
		]);
		const mockConversations = vi.fn().mockReturnValue({
			participants: { list: mockParticipantsList },
		});
		const client = {
			conversations: {
				v1: { conversations: mockConversations },
			},
			request: mockRequest,
		} as unknown as TwilioClient;

		await sendTypingIndicator(client, payload, correlation);

		expect(logSpy).toHaveBeenCalledWith(
			"[whatsapp]",
			expect.objectContaining({
				event: "whatsapp.typing.sent",
				messageSid: "SM-custom",
				waId: "custom-wa-id",
				chatId: "chat-456",
			}),
		);

		logSpy.mockRestore();
	});
});

describe("sendWhatsAppMessage", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("sends message with formatted WhatsApp numbers", async () => {
		const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
		const mockCreate = vi
			.fn()
			.mockResolvedValue({ sid: "SM123", status: "sent" });
		const client = {
			messages: { create: mockCreate },
		} as unknown as TwilioClient;

		const result = await sendWhatsAppMessage({
			client,
			to: "+15559876543",
			response: "Hello!",
		});

		expect(result).toEqual({ sid: "SM123", status: "sent" });
		expect(mockCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				to: "whatsapp:+15559876543",
				body: "Hello!",
				from: "whatsapp:+15551234567",
			}),
		);

		logSpy.mockRestore();
	});

	it("uses custom from number when provided", async () => {
		const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
		const mockCreate = vi
			.fn()
			.mockResolvedValue({ sid: "SM123", status: "sent" });
		const client = {
			messages: { create: mockCreate },
		} as unknown as TwilioClient;

		await sendWhatsAppMessage({
			client,
			to: "+15559876543",
			from: "+15550001111",
			response: "Hello!",
		});

		expect(mockCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				from: "whatsapp:+15550001111",
			}),
		);

		logSpy.mockRestore();
	});

	it("logs outbound message with correlation", async () => {
		const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
		const mockCreate = vi
			.fn()
			.mockResolvedValue({ sid: "SM123", status: "queued" });
		const client = {
			messages: { create: mockCreate },
		} as unknown as TwilioClient;

		await sendWhatsAppMessage({
			client,
			to: "+15559876543",
			response: "Hello!",
			correlation: {
				messageSid: "SM-incoming",
				waId: "123456",
				chatId: "chat-789",
			},
		});

		expect(logSpy).toHaveBeenCalledWith(
			"[whatsapp]",
			expect.objectContaining({
				event: "whatsapp.outbound.sent",
				messageSid: "SM-incoming",
				waId: "123456",
				chatId: "chat-789",
				status: "queued",
			}),
		);

		logSpy.mockRestore();
	});

	it("throws and records exception on error", async () => {
		const mockCreate = vi.fn().mockRejectedValue(new Error("API error"));
		const client = {
			messages: { create: mockCreate },
		} as unknown as TwilioClient;

		await expect(
			sendWhatsAppMessage({
				client,
				to: "+15559876543",
				response: "Hello!",
			}),
		).rejects.toThrow("API error");
	});

	it("handles number already prefixed with whatsapp:", async () => {
		const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
		const mockCreate = vi
			.fn()
			.mockResolvedValue({ sid: "SM123", status: "sent" });
		const client = {
			messages: { create: mockCreate },
		} as unknown as TwilioClient;

		await sendWhatsAppMessage({
			client,
			to: "whatsapp:+15559876543",
			response: "Hello!",
		});

		expect(mockCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				to: "whatsapp:+15559876543",
			}),
		);

		logSpy.mockRestore();
	});
});
