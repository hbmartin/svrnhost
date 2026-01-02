import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, GET } from "@/app/(chat)/api/history/route";

const mocks = vi.hoisted(() => ({
	auth: vi.fn(),
	getChatsByUserId: vi.fn(),
	deleteAllChatsByUserId: vi.fn(),
}));

vi.mock("@/app/(auth)/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db/queries", () => ({
	getChatsByUserId: mocks.getChatsByUserId,
	deleteAllChatsByUserId: mocks.deleteAllChatsByUserId,
}));

beforeEach(() => {
	mocks.auth.mockReset();
	mocks.getChatsByUserId.mockReset();
	mocks.deleteAllChatsByUserId.mockReset();
});

describe("/api/history GET", () => {
	it("returns 400 when both cursors are provided", async () => {
		const request = new NextRequest(
			"http://localhost/api/history?starting_after=a&ending_before=b",
		);

		const response = await GET(request);
		expect(response.status).toBe(400);
	});

	it("returns 401 when unauthenticated", async () => {
		mocks.auth.mockResolvedValue(null);
		const request = new NextRequest("http://localhost/api/history");

		const response = await GET(request);
		expect(response.status).toBe(401);
	});

	it("returns chat history for authenticated user", async () => {
		mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
		mocks.getChatsByUserId.mockResolvedValue({ chats: [], hasMore: false });
		const request = new NextRequest("http://localhost/api/history?limit=5");

		const response = await GET(request);
		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.chats).toEqual([]);
	});
});

describe("/api/history DELETE", () => {
	it("returns 401 when unauthenticated", async () => {
		mocks.auth.mockResolvedValue(null);
		const request = new Request("http://localhost/api/history", {
			method: "DELETE",
		});
		const response = await DELETE(request);
		expect(response.status).toBe(401);
	});

	it("deletes all chats for authenticated user", async () => {
		mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
		mocks.deleteAllChatsByUserId.mockResolvedValue({ deletedCount: 2 });

		const request = new Request("http://localhost/api/history", {
			method: "DELETE",
		});
		const response = await DELETE(request);
		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.deletedCount).toBe(2);
	});
});
