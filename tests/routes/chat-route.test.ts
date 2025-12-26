import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/(chat)/api/chat/route";
import { ChatSDKError } from "@/lib/errors";

const mocks = vi.hoisted(() => ({
	auth: vi.fn(),
	generateTitleFromUserMessage: vi.fn(),
	getMessageCountByUserId: vi.fn(),
	getChatById: vi.fn(),
	getMessagesByChatId: vi.fn(),
	saveChat: vi.fn(),
	saveMessages: vi.fn(),
	createStreamId: vi.fn(),
	updateChatLastContextById: vi.fn(),
}));

vi.mock("@/app/(auth)/auth", () => ({ auth: mocks.auth }));
vi.mock("@/app/(chat)/actions", () => ({
	generateTitleFromUserMessage: mocks.generateTitleFromUserMessage,
}));
vi.mock("@vercel/functions", () => ({
	geolocation: () => ({ latitude: 0, longitude: 0 }),
}));
vi.mock("@/lib/db/queries", () => ({
	getMessageCountByUserId: mocks.getMessageCountByUserId,
	getChatById: mocks.getChatById,
	getMessagesByChatId: mocks.getMessagesByChatId,
	saveChat: mocks.saveChat,
	saveMessages: mocks.saveMessages,
	createStreamId: mocks.createStreamId,
	updateChatLastContextById: mocks.updateChatLastContextById,
}));
vi.mock("ai", async (importOriginal) => {
	const actual = await importOriginal<typeof import("ai")>();
	return {
		...actual,
		createUIMessageStream: vi.fn(() => new ReadableStream()),
		JsonToSseTransformStream: class extends TransformStream {},
		convertToModelMessages: vi.fn(async () => []),
		smoothStream: vi.fn(),
		stepCountIs: vi.fn(),
		streamText: vi.fn(() => ({
			consumeStream: vi.fn(),
			toUIMessageStream: vi.fn(() => new ReadableStream()),
		})),
	};
});

const validBody = {
	id: "00000000-0000-0000-0000-000000000000",
	message: {
		id: "00000000-0000-0000-0000-000000000000",
		role: "user" as const,
		parts: [{ type: "text", text: "Why is the sky blue?" }],
	},
	selectedChatModel: "chat-model" as const,
	selectedVisibilityType: "private" as const,
};

beforeEach(() => {
	mocks.auth.mockReset();
	mocks.generateTitleFromUserMessage.mockReset();
	mocks.getMessageCountByUserId.mockReset();
	mocks.getChatById.mockReset();
	mocks.getMessagesByChatId.mockReset();
	mocks.saveChat.mockReset();
	mocks.saveMessages.mockReset();
	mocks.createStreamId.mockReset();
	mocks.updateChatLastContextById.mockReset();
});

describe("/api/chat POST", () => {
	it("returns 400 for invalid body", async () => {
		const response = await POST(
			new Request("http://localhost/api/chat", {
				method: "POST",
				body: JSON.stringify({}),
			}),
		);

		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.code).toBe("bad_request:api");
	});

	it("returns 401 when unauthenticated", async () => {
		mocks.auth.mockResolvedValue(null);

		const response = await POST(
			new Request("http://localhost/api/chat", {
				method: "POST",
				body: JSON.stringify(validBody),
			}),
		);

		expect(response.status).toBe(401);
	});

	it("returns 429 when rate limited", async () => {
		mocks.auth.mockResolvedValue({ user: { id: "user-1", type: "regular" } });
		mocks.getMessageCountByUserId.mockResolvedValue(101);

		const response = await POST(
			new Request("http://localhost/api/chat", {
				method: "POST",
				body: JSON.stringify(validBody),
			}),
		);

		expect(response.status).toBe(429);
	});

	it("returns 403 when chat belongs to someone else", async () => {
		mocks.auth.mockResolvedValue({ user: { id: "user-1", type: "regular" } });
		mocks.getMessageCountByUserId.mockResolvedValue(0);
		mocks.getChatById.mockResolvedValue({ id: validBody.id, userId: "user-2" });

		const response = await POST(
			new Request("http://localhost/api/chat", {
				method: "POST",
				body: JSON.stringify(validBody),
			}),
		);

		expect(response.status).toBe(403);
	});

	it("creates a new chat and streams response", async () => {
		mocks.auth.mockResolvedValue({ user: { id: "user-1", type: "regular" } });
		mocks.getMessageCountByUserId.mockResolvedValue(0);
		mocks.getChatById.mockResolvedValue(null);
		mocks.generateTitleFromUserMessage.mockResolvedValue("Test title");
		mocks.saveChat.mockResolvedValue(undefined);
		mocks.saveMessages.mockResolvedValue(undefined);
		mocks.createStreamId.mockResolvedValue(undefined);

		const response = await POST(
			new Request("http://localhost/api/chat", {
				method: "POST",
				body: JSON.stringify(validBody),
			}),
		);

		expect(response.status).toBe(200);
		expect(mocks.saveChat).toHaveBeenCalledWith({
			id: validBody.id,
			userId: "user-1",
			title: "Test title",
		});
		expect(mocks.saveMessages).toHaveBeenCalled();
		expect(mocks.createStreamId).toHaveBeenCalled();
	});

	it("continues existing chat with prior messages", async () => {
		mocks.auth.mockResolvedValue({ user: { id: "user-1", type: "regular" } });
		mocks.getMessageCountByUserId.mockResolvedValue(5);
		mocks.getChatById.mockResolvedValue({
			id: validBody.id,
			userId: "user-1",
		});
		mocks.getMessagesByChatId.mockResolvedValue([
			{
				id: "msg-1",
				role: "user",
				parts: [{ type: "text", text: "Hello" }],
				createdAt: new Date(),
			},
			{
				id: "msg-2",
				role: "assistant",
				parts: [{ type: "text", text: "Hi there!" }],
				createdAt: new Date(),
			},
		]);
		mocks.saveMessages.mockResolvedValue(undefined);
		mocks.createStreamId.mockResolvedValue(undefined);

		const response = await POST(
			new Request("http://localhost/api/chat", {
				method: "POST",
				body: JSON.stringify(validBody),
			}),
		);

		expect(response.status).toBe(200);
		expect(mocks.getMessagesByChatId).toHaveBeenCalledWith({
			id: validBody.id,
		});
		expect(mocks.saveChat).not.toHaveBeenCalled();
	});

	it("returns 503 for unhandled errors", async () => {
		mocks.auth.mockResolvedValue({ user: { id: "user-1", type: "regular" } });
		mocks.getMessageCountByUserId.mockRejectedValue(
			new Error("Database error"),
		);

		const response = await POST(
			new Request("http://localhost/api/chat", {
				method: "POST",
				body: JSON.stringify(validBody),
			}),
		);

		expect(response.status).toBe(503);
		const body = await response.json();
		expect(body.code).toBe("offline:chat");
	});

	it("returns 400 for AI Gateway credit card error", async () => {
		mocks.auth.mockResolvedValue({ user: { id: "user-1", type: "regular" } });
		mocks.getMessageCountByUserId.mockRejectedValue(
			new Error(
				"AI Gateway requires a valid credit card on file to service requests",
			),
		);

		const response = await POST(
			new Request("http://localhost/api/chat", {
				method: "POST",
				body: JSON.stringify(validBody),
			}),
		);

		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.code).toBe("bad_request:activate_gateway");
	});

	it("handles ChatSDKError thrown from nested calls", async () => {
		mocks.auth.mockResolvedValue({ user: { id: "user-1", type: "regular" } });
		mocks.getMessageCountByUserId.mockRejectedValue(
			new ChatSDKError("not_found:chat"),
		);

		const response = await POST(
			new Request("http://localhost/api/chat", {
				method: "POST",
				body: JSON.stringify(validBody),
			}),
		);

		expect(response.status).toBe(404);
		const body = await response.json();
		expect(body.code).toBe("not_found:chat");
	});
});
