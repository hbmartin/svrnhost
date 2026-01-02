import { describe, expect, it } from "vitest";
import { GET } from "@/app/api/health/route";

describe("GET /api/health", () => {
	it("returns 200 OK", async () => {
		const response = await GET();

		expect(response.status).toBe(200);
	});

	it("returns JSON with status ok", async () => {
		const response = await GET();
		const body = await response.json();

		expect(body.status).toBe("ok");
	});

	it("returns service name", async () => {
		const response = await GET();
		const body = await response.json();

		expect(body.service).toBe("ai-chatbot");
	});

	it("returns ISO timestamp", async () => {
		const response = await GET();
		const body = await response.json();

		expect(body.timestamp).toBeDefined();
		// Verify it's a valid ISO date string
		expect(() => new Date(body.timestamp)).not.toThrow();
	});
});
