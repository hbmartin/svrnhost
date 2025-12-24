import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/(chat)/api/chat/[id]/stream/route";

const mocks = vi.hoisted(() => ({
	auth: vi.fn(),
	getChatById: vi.fn(),
	getStreamIdsByChatId: vi.fn(),
	getMessagesByChatId: vi.fn(),
	getStreamContext: vi.fn(),
}));

vi.mock("@/app/(auth)/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db/queries", () => ({
	getChatById: mocks.getChatById,
	getStreamIdsByChatId: mocks.getStreamIdsByChatId,
	getMessagesByChatId: mocks.getMessagesByChatId,
}));
vi.mock("@/app/(chat)/api/chat/route", () => ({
	getStreamContext: mocks.getStreamContext,
}));
vi.mock("ai", () => ({
	createUIMessageStream: vi.fn(() => new ReadableStream()),
	JsonToSseTransformStream: class extends TransformStream {},
}));

beforeEach(() => {
	mocks.auth.mockReset();
	mocks.getChatById.mockReset();
	mocks.getStreamIdsByChatId.mockReset();
	mocks.getMessagesByChatId.mockReset();
	mocks.getStreamContext.mockReset();
});

describe("/api/chat/[id]/stream GET", () => {
	it("returns 204 when stream context is missing", async () => {
		mocks.getStreamContext.mockReturnValue(null);

		const response = await GET(new Request("http://localhost"), {
			params: Promise.resolve({ id: "chat-1" }),
		});

		expect(response.status).toBe(204);
	});

	it("returns 400 when chatId is missing", async () => {
		mocks.getStreamContext.mockReturnValue({
			resumableStream: vi.fn(),
		});

		const response = await GET(new Request("http://localhost"), {
			params: Promise.resolve({ id: "" }),
		});

		expect(response.status).toBe(400);
	});

	it("returns 401 when unauthenticated", async () => {
		mocks.getStreamContext.mockReturnValue({
			resumableStream: vi.fn(),
		});
		mocks.auth.mockResolvedValue(null);

		const response = await GET(new Request("http://localhost"), {
			params: Promise.resolve({ id: "chat-1" }),
		});

		expect(response.status).toBe(401);
	});

	it("returns 404 when chat is not found", async () => {
		mocks.getStreamContext.mockReturnValue({
			resumableStream: vi.fn(),
		});
		mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
		mocks.getChatById.mockResolvedValue(null);

		const response = await GET(new Request("http://localhost"), {
			params: Promise.resolve({ id: "chat-1" }),
		});

		expect(response.status).toBe(404);
	});

	it("returns 403 for private chats owned by another user", async () => {
		mocks.getStreamContext.mockReturnValue({
			resumableStream: vi.fn(),
		});
		mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
		mocks.getChatById.mockResolvedValue({
			id: "chat-1",
			userId: "user-2",
			visibility: "private",
		});

		const response = await GET(new Request("http://localhost"), {
			params: Promise.resolve({ id: "chat-1" }),
		});

		expect(response.status).toBe(403);
	});

	it("returns 404 when no stream ids exist", async () => {
		mocks.getStreamContext.mockReturnValue({
			resumableStream: vi.fn(),
		});
		mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
		mocks.getChatById.mockResolvedValue({
			id: "chat-1",
			userId: "user-1",
			visibility: "private",
		});
		mocks.getStreamIdsByChatId.mockResolvedValue([]);

		const response = await GET(new Request("http://localhost"), {
			params: Promise.resolve({ id: "chat-1" }),
		});

		expect(response.status).toBe(404);
	});

	it("returns 200 when stream is available", async () => {
		const resumableStream = vi.fn().mockResolvedValue(new ReadableStream());
		mocks.getStreamContext.mockReturnValue({ resumableStream });
		mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
		mocks.getChatById.mockResolvedValue({
			id: "chat-1",
			userId: "user-1",
			visibility: "private",
		});
		mocks.getStreamIdsByChatId.mockResolvedValue(["stream-1"]);

		const response = await GET(new Request("http://localhost"), {
			params: Promise.resolve({ id: "chat-1" }),
		});

		expect(response.status).toBe(200);
	});
});
