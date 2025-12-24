import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, PATCH } from "@/app/(chat)/api/vote/route";

const mocks = vi.hoisted(() => ({
	auth: vi.fn(),
	getChatById: vi.fn(),
	getVotesByChatId: vi.fn(),
	voteMessage: vi.fn(),
}));

vi.mock("@/app/(auth)/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db/queries", () => ({
	getChatById: mocks.getChatById,
	getVotesByChatId: mocks.getVotesByChatId,
	voteMessage: mocks.voteMessage,
}));

beforeEach(() => {
	mocks.auth.mockReset();
	mocks.getChatById.mockReset();
	mocks.getVotesByChatId.mockReset();
	mocks.voteMessage.mockReset();
});

describe("/api/vote GET", () => {
	it("returns 400 when chatId is missing", async () => {
		const response = await GET(new Request("http://localhost/api/vote"));
		expect(response.status).toBe(400);
	});

	it("returns 401 when unauthenticated", async () => {
		mocks.auth.mockResolvedValue(null);

		const response = await GET(
			new Request("http://localhost/api/vote?chatId=chat-1"),
		);

		expect(response.status).toBe(401);
	});

	it("returns 404 when chat not found", async () => {
		mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
		mocks.getChatById.mockResolvedValue(null);

		const response = await GET(
			new Request("http://localhost/api/vote?chatId=chat-1"),
		);

		expect(response.status).toBe(404);
	});

	it("returns votes for authorized user", async () => {
		mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
		mocks.getChatById.mockResolvedValue({ id: "chat-1", userId: "user-1" });
		mocks.getVotesByChatId.mockResolvedValue([
			{ chatId: "chat-1", messageId: "msg-1", isUpvoted: true },
		]);

		const response = await GET(
			new Request("http://localhost/api/vote?chatId=chat-1"),
		);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body).toHaveLength(1);
	});
});

describe("/api/vote PATCH", () => {
	it("returns 400 when payload is incomplete", async () => {
		const response = await PATCH(
			new Request("http://localhost/api/vote", {
				method: "PATCH",
				body: JSON.stringify({ chatId: "chat-1" }),
			}),
		);
		expect(response.status).toBe(400);
	});

	it("returns 403 when chat belongs to another user", async () => {
		mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
		mocks.getChatById.mockResolvedValue({ id: "chat-1", userId: "user-2" });

		const response = await PATCH(
			new Request("http://localhost/api/vote", {
				method: "PATCH",
				body: JSON.stringify({
					chatId: "chat-1",
					messageId: "msg-1",
					type: "up",
				}),
			}),
		);

		expect(response.status).toBe(403);
	});

	it("updates a vote for the owner", async () => {
		mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
		mocks.getChatById.mockResolvedValue({ id: "chat-1", userId: "user-1" });
		mocks.voteMessage.mockResolvedValue(undefined);

		const response = await PATCH(
			new Request("http://localhost/api/vote", {
				method: "PATCH",
				body: JSON.stringify({
					chatId: "chat-1",
					messageId: "msg-1",
					type: "down",
				}),
			}),
		);

		expect(response.status).toBe(200);
		expect(mocks.voteMessage).toHaveBeenCalledWith({
			chatId: "chat-1",
			messageId: "msg-1",
			type: "down",
		});
	});
});
