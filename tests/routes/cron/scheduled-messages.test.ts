import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// Mock the scheduled processor
vi.mock("@/lib/templates/scheduled-processor", () => ({
	processPendingScheduledMessages: vi.fn(),
}));

describe("GET /api/cron/scheduled-messages", () => {
	beforeEach(() => {
		vi.resetModules();
	});

	afterEach(() => {
		vi.unstubAllEnvs();
		vi.clearAllMocks();
	});

	it("returns 401 when CRON_SECRET is set but auth header is missing", async () => {
		process.env["CRON_SECRET"] = "test-secret";

		const { GET } = await import(
			"@/app/api/cron/scheduled-messages/route"
		);

		const request = new NextRequest("http://localhost/api/cron/scheduled-messages");
		const response = await GET(request);

		expect(response.status).toBe(401);
		const body = await response.json();
		expect(body.error).toBe("Unauthorized");
	});

	it("returns 401 when CRON_SECRET is set but auth header is wrong", async () => {
		process.env["CRON_SECRET"] = "test-secret";

		const { GET } = await import(
			"@/app/api/cron/scheduled-messages/route"
		);

		const request = new NextRequest("http://localhost/api/cron/scheduled-messages", {
			headers: {
				authorization: "Bearer wrong-secret",
			},
		});
		const response = await GET(request);

		expect(response.status).toBe(401);
	});

	it("processes messages when auth is valid", async () => {
		process.env["CRON_SECRET"] = "test-secret";

		const { processPendingScheduledMessages } = await import(
			"@/lib/templates/scheduled-processor"
		);
		vi.mocked(processPendingScheduledMessages).mockResolvedValue({
			processed: 2,
			succeeded: 1,
			failed: 1,
			errors: [{ id: "msg-1", error: "Test error" }],
		});

		const { GET } = await import(
			"@/app/api/cron/scheduled-messages/route"
		);

		const request = new NextRequest("http://localhost/api/cron/scheduled-messages", {
			headers: {
				authorization: "Bearer test-secret",
			},
		});
		const response = await GET(request);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.success).toBe(true);
		expect(body.processed).toBe(2);
		expect(body.succeeded).toBe(1);
		expect(body.failed).toBe(1);
	});

	it("allows requests when CRON_SECRET is not set", async () => {
		delete process.env["CRON_SECRET"];

		const { processPendingScheduledMessages } = await import(
			"@/lib/templates/scheduled-processor"
		);
		vi.mocked(processPendingScheduledMessages).mockResolvedValue({
			processed: 0,
			succeeded: 0,
			failed: 0,
			errors: [],
		});

		const { GET } = await import(
			"@/app/api/cron/scheduled-messages/route"
		);

		const request = new NextRequest("http://localhost/api/cron/scheduled-messages");
		const response = await GET(request);

		expect(response.status).toBe(200);
	});

	it("returns 500 when processor throws", async () => {
		delete process.env["CRON_SECRET"];

		const { processPendingScheduledMessages } = await import(
			"@/lib/templates/scheduled-processor"
		);
		vi.mocked(processPendingScheduledMessages).mockRejectedValue(
			new Error("Database error"),
		);

		const { GET } = await import(
			"@/app/api/cron/scheduled-messages/route"
		);

		const request = new NextRequest("http://localhost/api/cron/scheduled-messages");
		const response = await GET(request);

		expect(response.status).toBe(500);
		const body = await response.json();
		expect(body.success).toBe(false);
		expect(body.error).toBe("Database error");
	});
});
