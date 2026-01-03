import { beforeEach, describe, expect, it, vi } from "vitest";

const validateTwilioRequestMock = vi.fn();
const createPendingLogMock = vi.fn();
const getTwilioConfigMock = vi.fn();

vi.mock("next/server", () => ({
	after: (callback?: () => void) => callback?.(),
}));

vi.mock("@/app/api/whatsapp/twilio", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("@/app/api/whatsapp/twilio")>();
	return {
		...actual,
		validateTwilioRequest: validateTwilioRequestMock,
	};
});

vi.mock("@/app/api/whatsapp/repository", () => ({
	createPendingLog: createPendingLogMock,
	logWebhookError: vi.fn(),
}));

vi.mock("@/app/api/whatsapp/service", () => ({
	processWhatsAppMessage: vi.fn(),
}));

vi.mock("@/lib/config/server", () => ({
	getTwilioConfig: () => getTwilioConfigMock(),
	vercelEnv: "test",
}));

const createValidBody = (overrides: Record<string, string> = {}) =>
	new URLSearchParams({
		MessageSid: "SM123",
		From: "+15551234567",
		To: "+15557654321",
		...overrides,
	}).toString();

describe("WhatsApp webhook route", () => {
	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();

		getTwilioConfigMock.mockReturnValue({
			accountSid: "AC123",
			authToken: "token",
			whatsappWebhookUrl: "https://configured.example.com/api/whatsapp",
		});

		validateTwilioRequestMock.mockReturnValue(true);
		createPendingLogMock.mockResolvedValue({ outcome: "duplicate" });
	});

	it("validates signature against the actual request URL Twilio sends", async () => {
		const { POST } = await import("@/app/api/whatsapp/route");

		const requestUrl = "https://actual.example.com/api/whatsapp";
		const body = createValidBody();

		const request = new Request(requestUrl, {
			method: "POST",
			body,
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
				"x-twilio-signature": "abc123",
			},
		});

		const response = await POST(request);

		expect(validateTwilioRequestMock).toHaveBeenCalledWith(
			"abc123",
			requestUrl,
			expect.objectContaining({
				MessageSid: "SM123",
				From: "+15551234567",
				To: "+15557654321",
			}),
		);
		expect(response.status).toBe(200);
	});

	it("returns 400 for missing payload", async () => {
		const { POST } = await import("@/app/api/whatsapp/route");

		const request = new Request("https://example.com/api/whatsapp", {
			method: "POST",
			body: "",
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
			},
		});

		const response = await POST(request);

		expect(response.status).toBe(400);
		expect(await response.text()).toBe("Missing payload");
	});

	it("returns 400 for invalid payload schema", async () => {
		const { POST } = await import("@/app/api/whatsapp/route");

		// Missing required fields
		const body = new URLSearchParams({
			InvalidField: "value",
		}).toString();

		const request = new Request("https://example.com/api/whatsapp", {
			method: "POST",
			body,
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
				"x-twilio-signature": "abc123",
			},
		});

		const response = await POST(request);

		expect(response.status).toBe(400);
		expect(await response.text()).toBe("Invalid payload");
	});

	it("returns 500 when getTwilioConfig throws", async () => {
		getTwilioConfigMock.mockImplementation(() => {
			throw new Error("Missing TWILIO_AUTH_TOKEN");
		});

		const { POST } = await import("@/app/api/whatsapp/route");
		const body = createValidBody();

		const request = new Request("https://example.com/api/whatsapp", {
			method: "POST",
			body,
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
				"x-twilio-signature": "abc123",
			},
		});

		const response = await POST(request);

		expect(response.status).toBe(500);
		expect(await response.text()).toBe("Server misconfigured");
	});

	it("returns 500 when config throws non-Error", async () => {
		getTwilioConfigMock.mockImplementation(() => {
			throw "string error";
		});

		const { POST } = await import("@/app/api/whatsapp/route");
		const body = createValidBody();

		const request = new Request("https://example.com/api/whatsapp", {
			method: "POST",
			body,
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
				"x-twilio-signature": "abc123",
			},
		});

		const response = await POST(request);

		expect(response.status).toBe(500);
		expect(await response.text()).toBe("Server misconfigured");
	});

	it("returns 403 for missing signature header", async () => {
		const { POST } = await import("@/app/api/whatsapp/route");
		const body = createValidBody();

		const request = new Request("https://example.com/api/whatsapp", {
			method: "POST",
			body,
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
				// No x-twilio-signature header
			},
		});

		const response = await POST(request);

		expect(response.status).toBe(403);
		expect(await response.text()).toBe("Forbidden");
	});

	it("returns 403 for invalid signature", async () => {
		validateTwilioRequestMock.mockReturnValue(false);

		const { POST } = await import("@/app/api/whatsapp/route");
		const body = createValidBody();

		const request = new Request("https://example.com/api/whatsapp", {
			method: "POST",
			body,
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
				"x-twilio-signature": "invalid-signature",
			},
		});

		const response = await POST(request);

		expect(response.status).toBe(403);
		expect(await response.text()).toBe("Forbidden");
	});

	it("returns 200 for duplicate message", async () => {
		createPendingLogMock.mockResolvedValue({ outcome: "duplicate" });

		const { POST } = await import("@/app/api/whatsapp/route");
		const body = createValidBody();

		const request = new Request("https://example.com/api/whatsapp", {
			method: "POST",
			body,
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
				"x-twilio-signature": "abc123",
			},
		});

		const response = await POST(request);

		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toBe("text/xml");
		expect(await response.text()).toBe("<Response></Response>");
	});

	it("returns 200 TwiML when createPendingLog returns error to prevent retry storms", async () => {
		createPendingLogMock.mockResolvedValue({ outcome: "error" });

		const { POST } = await import("@/app/api/whatsapp/route");
		const body = createValidBody();

		const request = new Request("https://example.com/api/whatsapp", {
			method: "POST",
			body,
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
				"x-twilio-signature": "abc123",
			},
		});

		const response = await POST(request);

		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toBe("text/xml");
		expect(await response.text()).toBe("<Response></Response>");
	});

	it("returns 200 and queues processing for new message", async () => {
		createPendingLogMock.mockResolvedValue({ outcome: "created" });

		const { POST } = await import("@/app/api/whatsapp/route");
		const body = createValidBody();

		const request = new Request("https://example.com/api/whatsapp", {
			method: "POST",
			body,
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
				"x-twilio-signature": "abc123",
			},
		});

		const response = await POST(request);

		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toBe("text/xml");
		expect(await response.text()).toBe("<Response></Response>");
	});

	it("logs webhook URL mismatch when config differs from request", async () => {
		const logSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

		getTwilioConfigMock.mockReturnValue({
			accountSid: "AC123",
			authToken: "token",
			whatsappWebhookUrl: "https://configured.example.com/api/whatsapp",
		});

		const { POST } = await import("@/app/api/whatsapp/route");
		const body = createValidBody();

		const request = new Request("https://different.example.com/api/whatsapp", {
			method: "POST",
			body,
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
				"x-twilio-signature": "abc123",
			},
		});

		await POST(request);

		expect(logSpy).toHaveBeenCalledWith(
			"[whatsapp]",
			expect.objectContaining({
				event: "whatsapp.inbound.webhook_url_mismatch",
			}),
		);

		logSpy.mockRestore();
	});

	it("parses raw message sid and wa id from params", async () => {
		const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

		const { POST } = await import("@/app/api/whatsapp/route");
		const body = createValidBody({
			MessageSid: "SM999",
			WaId: "123456789",
		});

		const request = new Request("https://example.com/api/whatsapp", {
			method: "POST",
			body,
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
				"x-twilio-signature": "abc123",
			},
		});

		await POST(request);

		expect(logSpy).toHaveBeenCalledWith(
			"[whatsapp]",
			expect.objectContaining({
				event: "whatsapp.inbound.received",
				messageSid: "SM999",
				waId: "123456789",
			}),
		);

		logSpy.mockRestore();
	});
});
