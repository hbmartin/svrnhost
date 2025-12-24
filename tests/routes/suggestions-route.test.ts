import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/(chat)/api/suggestions/route";

const mocks = vi.hoisted(() => ({
	auth: vi.fn(),
	getSuggestionsByDocumentId: vi.fn(),
}));

vi.mock("@/app/(auth)/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/db/queries", () => ({
	getSuggestionsByDocumentId: mocks.getSuggestionsByDocumentId,
}));

beforeEach(() => {
	mocks.auth.mockReset();
	mocks.getSuggestionsByDocumentId.mockReset();
});

describe("/api/suggestions GET", () => {
	it("returns 400 when documentId is missing", async () => {
		const response = await GET(new Request("http://localhost/api/suggestions"));
		expect(response.status).toBe(400);
	});

	it("returns 401 when unauthenticated", async () => {
		mocks.auth.mockResolvedValue(null);

		const response = await GET(
			new Request("http://localhost/api/suggestions?documentId=doc-1"),
		);

		expect(response.status).toBe(401);
	});

	it("returns 403 when suggestions belong to another user", async () => {
		mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
		mocks.getSuggestionsByDocumentId.mockResolvedValue([
			{ documentId: "doc-1", userId: "user-2" },
		]);

		const response = await GET(
			new Request("http://localhost/api/suggestions?documentId=doc-1"),
		);

		expect(response.status).toBe(403);
	});

	it("returns suggestions for the owner", async () => {
		mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
		mocks.getSuggestionsByDocumentId.mockResolvedValue([
			{ documentId: "doc-1", userId: "user-1", content: "Try this" },
		]);

		const response = await GET(
			new Request("http://localhost/api/suggestions?documentId=doc-1"),
		);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body).toHaveLength(1);
	});
});
