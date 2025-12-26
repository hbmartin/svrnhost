import { beforeEach, describe, expect, it, vi } from "vitest";

const validateTwilioRequestMock = vi.fn();
const createPendingLogMock = vi.fn();

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

describe("WhatsApp webhook route", () => {
	beforeEach(() => {
		vi.resetModules();
		vi.clearAllMocks();

		process.env["TWILIO_ACCOUNT_SID"] = "AC123";
		process.env["TWILIO_AUTH_TOKEN"] = "token";
		process.env["TWILIO_WHATSAPP_WEBHOOK_URL"] =
			"https://configured.example.com/api/whatsapp";

		validateTwilioRequestMock.mockReturnValue(true);
		createPendingLogMock.mockResolvedValue({ outcome: "duplicate" });
	});

	it("validates signature against the actual request URL Twilio sends", async () => {
		const { POST } = await import("@/app/api/whatsapp/route");

		const requestUrl = "https://actual.example.com/api/whatsapp";
		const body = new URLSearchParams({
			MessageSid: "SM123",
			From: "+15551234567",
			To: "+15557654321",
		}).toString();

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
});
