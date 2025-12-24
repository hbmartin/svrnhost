import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	deleteTrailingMessages,
	generateTitleFromUserMessage,
	saveChatModelAsCookie,
} from "@/app/(chat)/actions";

const mocks = vi.hoisted(() => ({
	cookiesSet: vi.fn(),
	cookies: vi.fn(),
	generateText: vi.fn(),
	getMessageById: vi.fn(),
	deleteMessagesByChatIdAfterTimestamp: vi.fn(),
}));

vi.mock("next/headers", () => ({
	cookies: mocks.cookies,
}));

vi.mock("ai", () => ({
	generateText: mocks.generateText,
}));

vi.mock("@/lib/ai/providers", () => ({
	myProvider: {
		languageModel: vi.fn(() => "title-model"),
	},
}));

vi.mock("@/lib/db/queries", () => ({
	getMessageById: mocks.getMessageById,
	deleteMessagesByChatIdAfterTimestamp:
		mocks.deleteMessagesByChatIdAfterTimestamp,
}));

beforeEach(() => {
	mocks.cookiesSet.mockReset();
	mocks.cookies.mockReset();
	mocks.generateText.mockReset();
	mocks.getMessageById.mockReset();
	mocks.deleteMessagesByChatIdAfterTimestamp.mockReset();
});

describe("saveChatModelAsCookie", () => {
	it("saves model to cookie", async () => {
		mocks.cookies.mockResolvedValue({ set: mocks.cookiesSet });

		await saveChatModelAsCookie("gpt-4");

		expect(mocks.cookiesSet).toHaveBeenCalledWith("chat-model", "gpt-4");
	});
});

describe("generateTitleFromUserMessage", () => {
	it("generates a title from the user message", async () => {
		mocks.generateText.mockResolvedValue({ text: "Generated Title" });

		const result = await generateTitleFromUserMessage({
			message: {
				id: "msg-1",
				role: "user",
				parts: [{ type: "text", text: "Hello world" }],
			},
		});

		expect(result).toBe("Generated Title");
		expect(mocks.generateText).toHaveBeenCalledWith(
			expect.objectContaining({
				prompt: "Hello world",
			}),
		);
	});
});

describe("deleteTrailingMessages", () => {
	it("deletes trailing messages when message exists", async () => {
		const testMessage = {
			id: "msg-1",
			chatId: "chat-1",
			createdAt: new Date("2024-01-01"),
		};
		mocks.getMessageById.mockResolvedValue([testMessage]);
		mocks.deleteMessagesByChatIdAfterTimestamp.mockResolvedValue(undefined);

		await deleteTrailingMessages({ id: "msg-1" });

		expect(mocks.deleteMessagesByChatIdAfterTimestamp).toHaveBeenCalledWith({
			chatId: "chat-1",
			timestamp: testMessage.createdAt,
		});
	});

	it("does nothing when message does not exist", async () => {
		mocks.getMessageById.mockResolvedValue([]);

		await deleteTrailingMessages({ id: "non-existent" });

		expect(mocks.deleteMessagesByChatIdAfterTimestamp).not.toHaveBeenCalled();
	});
});
