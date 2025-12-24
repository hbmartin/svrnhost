import type { UIMessage } from "ai";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DBMessage, Document } from "@/lib/db/schema";
import { ChatSDKError } from "@/lib/errors";
import {
	cn,
	convertToUIMessages,
	fetcher,
	fetchWithErrorHandlers,
	generateUUID,
	getDocumentTimestampByIndex,
	getLocalStorage,
	getMostRecentUserMessage,
	getTextFromMessage,
	getTrailingMessageId,
	sanitizeText,
} from "@/lib/utils";

describe("lib/utils", () => {
	describe("cn", () => {
		it("merges class names correctly", () => {
			expect(cn("foo", "bar")).toBe("foo bar");
		});

		it("handles conditional classes", () => {
			expect(cn("foo", false && "bar", "baz")).toBe("foo baz");
		});

		it("merges tailwind classes properly", () => {
			expect(cn("p-4", "p-2")).toBe("p-2");
		});
	});

	describe("fetcher", () => {
		beforeEach(() => {
			vi.stubGlobal("fetch", vi.fn());
		});

		afterEach(() => {
			vi.unstubAllGlobals();
		});

		it("returns JSON on successful response", async () => {
			const mockData = { message: "success" };
			vi.mocked(fetch).mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve(mockData),
			} as Response);

			const result = await fetcher("/api/test");
			expect(result).toEqual(mockData);
		});

		it("throws ChatSDKError on error response", async () => {
			vi.mocked(fetch).mockResolvedValueOnce({
				ok: false,
				json: () =>
					Promise.resolve({
						code: "bad_request:api",
						cause: "Invalid input",
					}),
			} as Response);

			await expect(fetcher("/api/test")).rejects.toThrow(ChatSDKError);
		});
	});

	describe("fetchWithErrorHandlers", () => {
		beforeEach(() => {
			vi.stubGlobal("fetch", vi.fn());
		});

		afterEach(() => {
			vi.unstubAllGlobals();
		});

		it("returns response on success", async () => {
			const mockResponse = {
				ok: true,
				json: () => Promise.resolve({ data: "test" }),
			} as Response;
			vi.mocked(fetch).mockResolvedValueOnce(mockResponse);

			const result = await fetchWithErrorHandlers("/api/test");
			expect(result).toBe(mockResponse);
		});

		it("throws ChatSDKError on error response", async () => {
			vi.mocked(fetch).mockResolvedValueOnce({
				ok: false,
				json: () =>
					Promise.resolve({
						code: "unauthorized:auth",
						cause: "Not logged in",
					}),
			} as Response);

			await expect(fetchWithErrorHandlers("/api/test")).rejects.toThrow(
				ChatSDKError,
			);
		});

		it("throws offline error when navigator is offline", async () => {
			vi.stubGlobal("navigator", { onLine: false });
			vi.mocked(fetch).mockRejectedValueOnce(new Error("Network error"));

			await expect(fetchWithErrorHandlers("/api/test")).rejects.toThrow(
				ChatSDKError,
			);

			try {
				await fetchWithErrorHandlers("/api/test");
			} catch (e) {
				expect((e as ChatSDKError).type).toBe("offline");
			}
		});

		it("rethrows original error when navigator is online", async () => {
			vi.stubGlobal("navigator", { onLine: true });
			const originalError = new Error("Some error");
			vi.mocked(fetch).mockRejectedValueOnce(originalError);

			await expect(fetchWithErrorHandlers("/api/test")).rejects.toThrow(
				originalError,
			);
		});
	});

	describe("getLocalStorage", () => {
		it("returns parsed JSON from localStorage", () => {
			localStorage.setItem("testKey", JSON.stringify([1, 2, 3]));
			expect(getLocalStorage("testKey")).toEqual([1, 2, 3]);
		});

		it("returns empty array for non-existent key", () => {
			expect(getLocalStorage("nonExistentKey")).toEqual([]);
		});
	});

	describe("generateUUID", () => {
		it("generates a valid UUID", () => {
			const uuid = generateUUID();
			expect(uuid).toMatch(
				/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
			);
		});

		it("throws error when crypto.randomUUID is not available", () => {
			const originalCrypto = globalThis.crypto;
			Object.defineProperty(globalThis, "crypto", {
				value: {},
				configurable: true,
			});

			expect(() => generateUUID()).toThrow(
				"crypto.randomUUID is not available",
			);

			Object.defineProperty(globalThis, "crypto", {
				value: originalCrypto,
				configurable: true,
			});
		});
	});

	describe("getMostRecentUserMessage", () => {
		it("returns the last user message", () => {
			const messages: UIMessage[] = [
				{ id: "1", role: "user", parts: [], createdAt: new Date() },
				{ id: "2", role: "assistant", parts: [], createdAt: new Date() },
				{ id: "3", role: "user", parts: [], createdAt: new Date() },
			];
			const result = getMostRecentUserMessage(messages);
			expect(result?.id).toBe("3");
		});

		it("returns undefined when no user messages exist", () => {
			const messages: UIMessage[] = [
				{ id: "1", role: "assistant", parts: [], createdAt: new Date() },
			];
			const result = getMostRecentUserMessage(messages);
			expect(result).toBeUndefined();
		});
	});

	describe("getDocumentTimestampByIndex", () => {
		it("returns document timestamp at index", () => {
			const timestamp = new Date("2024-01-15");
			const documents: Document[] = [
				{
					id: "1",
					title: "Doc 1",
					kind: "text",
					content: "content",
					userId: "user1",
					createdAt: timestamp,
				},
			];
			const result = getDocumentTimestampByIndex(documents, 0);
			expect(result).toEqual(timestamp);
		});

		it("returns current date when documents is empty", () => {
			const before = new Date();
			const result = getDocumentTimestampByIndex([], 0);
			const after = new Date();
			expect(result.getTime()).toBeGreaterThanOrEqual(before.getTime());
			expect(result.getTime()).toBeLessThanOrEqual(after.getTime());
		});

		it("returns current date when index is out of bounds", () => {
			const documents: Document[] = [
				{
					id: "1",
					title: "Doc 1",
					kind: "text",
					content: "content",
					userId: "user1",
					createdAt: new Date("2024-01-15"),
				},
			];
			const before = new Date();
			const result = getDocumentTimestampByIndex(documents, 5);
			const after = new Date();
			expect(result.getTime()).toBeGreaterThanOrEqual(before.getTime());
			expect(result.getTime()).toBeLessThanOrEqual(after.getTime());
		});
	});

	describe("getTrailingMessageId", () => {
		it("returns id of the last message", () => {
			const messages = [
				{ id: "msg-1", role: "assistant" as const, content: [] },
				{ id: "msg-2", role: "assistant" as const, content: [] },
			];
			const result = getTrailingMessageId({ messages });
			expect(result).toBe("msg-2");
		});

		it("returns null for empty messages array", () => {
			const result = getTrailingMessageId({ messages: [] });
			expect(result).toBeNull();
		});
	});

	describe("sanitizeText", () => {
		it("removes <has_function_call> tag", () => {
			const input = "Hello <has_function_call> world";
			expect(sanitizeText(input)).toBe("Hello  world");
		});

		it("returns unchanged text without the tag", () => {
			const input = "Hello world";
			expect(sanitizeText(input)).toBe("Hello world");
		});
	});

	describe("convertToUIMessages", () => {
		it("converts DB messages to UI messages", () => {
			const createdAt = new Date("2024-01-15T12:00:00Z");
			const dbMessages: DBMessage[] = [
				{
					id: "msg-1",
					chatId: "chat-1",
					role: "user",
					parts: [{ type: "text", text: "Hello" }],
					createdAt,
				},
			];

			const result = convertToUIMessages(dbMessages);

			expect(result).toHaveLength(1);
			expect(result[0]?.id).toBe("msg-1");
			expect(result[0]?.role).toBe("user");
			expect(result[0]?.parts).toEqual([{ type: "text", text: "Hello" }]);
			// formatISO uses local timezone, so just check it's a valid ISO string
			expect(result[0]?.metadata?.createdAt).toMatch(
				/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
			);
		});
	});

	describe("getTextFromMessage", () => {
		it("extracts text from message parts", () => {
			const message = {
				id: "1",
				role: "user" as const,
				parts: [
					{ type: "text" as const, text: "Hello " },
					{ type: "text" as const, text: "world" },
				],
			};
			expect(getTextFromMessage(message)).toBe("Hello world");
		});

		it("filters out non-text parts", () => {
			const message = {
				id: "1",
				role: "user" as const,
				parts: [
					{ type: "text" as const, text: "Hello" },
					{ type: "image" as const, image: "data:..." } as unknown as {
						type: "text";
						text: string;
					},
				],
			};
			expect(getTextFromMessage(message)).toBe("Hello");
		});

		it("returns empty string for message with no text parts", () => {
			const message = {
				id: "1",
				role: "user" as const,
				parts: [],
			};
			expect(getTextFromMessage(message)).toBe("");
		});
	});
});
