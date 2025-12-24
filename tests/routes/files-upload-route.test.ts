import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/(chat)/api/files/upload/route";

const mocks = vi.hoisted(() => ({
	auth: vi.fn(),
	put: vi.fn(),
}));

vi.mock("@/app/(auth)/auth", () => ({ auth: mocks.auth }));
vi.mock("@vercel/blob", () => ({ put: mocks.put }));

beforeEach(() => {
	mocks.auth.mockReset();
	mocks.put.mockReset();
});

describe("/api/files/upload POST", () => {
	it("returns 401 when unauthenticated", async () => {
		mocks.auth.mockResolvedValue(null);

		const response = await POST(
			new Request("http://localhost/api/files/upload"),
		);
		expect(response.status).toBe(401);
	});

	it("returns 400 when request body is missing", async () => {
		mocks.auth.mockResolvedValue({ user: { id: "user-1" } });

		const response = await POST(
			new Request("http://localhost/api/files/upload"),
		);
		expect(response.status).toBe(400);
	});

	it("rejects invalid file types", async () => {
		mocks.auth.mockResolvedValue({ user: { id: "user-1" } });

		const formData = new FormData();
		const file = Object.assign(new Blob(["content"], { type: "text/plain" }), {
			name: "test.txt",
		});
		formData.append("file", file);

		const request = {
			body: {},
			formData: async () => formData,
		} as unknown as Request;

		const response = await POST(request);

		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.error).toContain("File type should be JPEG or PNG");
	});

	it("uploads valid files", async () => {
		mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
		mocks.put.mockResolvedValue({
			url: "https://example.com/file.png",
			pathname: "file.png",
			contentType: "image/png",
		});

		const file = Object.assign(new Blob(["content"], { type: "image/png" }), {
			name: "file.png",
			arrayBuffer: async () => new ArrayBuffer(8),
		});
		const request = {
			body: {},
			formData: async () => ({
				get: () => file,
			}),
		} as unknown as Request;

		const response = await POST(request);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.url).toBe("https://example.com/file.png");
	});
});
