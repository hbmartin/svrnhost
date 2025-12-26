import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Helper to set up minimal valid env for module loading
function setupMinimalEnv() {
	// These are needed for the zod schema to pass at module load
	process.env["POSTGRES_URL"] = "postgres://test:test@localhost:5432/test";
}

describe("lib/config/server", () => {
	beforeEach(() => {
		vi.resetModules();
		setupMinimalEnv();
	});

	afterEach(() => {
		vi.unstubAllEnvs();
	});

	describe("getAiConfig", () => {
		it("returns AI config with keys from env", async () => {
			process.env["OPENAI_API_KEY"] = "test-openai-key";
			process.env["ANTHROPIC_API_KEY"] = "test-anthropic-key";

			const { getAiConfig } = await import("@/lib/config/server");
			const config = getAiConfig();

			expect(config.openAiApiKey).toBe("test-openai-key");
			expect(config.anthropicApiKey).toBe("test-anthropic-key");
			expect(config.hasOpenAiKey).toBe(true);
			expect(config.hasAnthropicKey).toBe(true);
		});

		it("returns cached config on subsequent calls", async () => {
			process.env["OPENAI_API_KEY"] = "test-key";

			const { getAiConfig } = await import("@/lib/config/server");
			const config1 = getAiConfig();
			const config2 = getAiConfig();

			expect(config1).toBe(config2);
		});

		it("uses AI_GATEWAY_API_KEY as fallback", async () => {
			delete process.env["OPENAI_API_KEY"];
			delete process.env["ANTHROPIC_API_KEY"];
			process.env["AI_GATEWAY_API_KEY"] = "gateway-key";

			const { getAiConfig } = await import("@/lib/config/server");
			const config = getAiConfig();

			expect(config.aiGatewayApiKey).toBe("gateway-key");
			expect(config.hasOpenAiKey).toBe(true);
			expect(config.hasAnthropicKey).toBe(true);
		});

		it("uses VERCEL_AI_API_KEY as secondary fallback", async () => {
			delete process.env["OPENAI_API_KEY"];
			delete process.env["ANTHROPIC_API_KEY"];
			delete process.env["AI_GATEWAY_API_KEY"];
			process.env["VERCEL_AI_API_KEY"] = "vercel-key";

			const { getAiConfig } = await import("@/lib/config/server");
			const config = getAiConfig();

			expect(config.aiGatewayApiKey).toBe("vercel-key");
		});

		it("reports missing keys when none are set", async () => {
			delete process.env["OPENAI_API_KEY"];
			delete process.env["ANTHROPIC_API_KEY"];
			delete process.env["AI_GATEWAY_API_KEY"];
			delete process.env["VERCEL_AI_API_KEY"];

			const { getAiConfig } = await import("@/lib/config/server");
			const config = getAiConfig();

			expect(config.hasOpenAiKey).toBe(false);
			expect(config.hasAnthropicKey).toBe(false);
		});
	});

	describe("getPostgresUrl", () => {
		it("returns POSTGRES_URL from env", async () => {
			process.env["POSTGRES_URL"] = "postgres://test:pass@localhost/db";

			const { getPostgresUrl } = await import("@/lib/config/server");
			const url = getPostgresUrl();

			expect(url).toBe("postgres://test:pass@localhost/db");
		});

		it("returns cached URL on subsequent calls", async () => {
			process.env["POSTGRES_URL"] = "postgres://cached@localhost/db";

			const { getPostgresUrl } = await import("@/lib/config/server");
			const url1 = getPostgresUrl();
			const url2 = getPostgresUrl();

			expect(url1).toBe(url2);
		});

		it("throws when POSTGRES_URL is not set", async () => {
			delete process.env["POSTGRES_URL"];

			const { getPostgresUrl } = await import("@/lib/config/server");

			expect(() => getPostgresUrl()).toThrow(
				"Missing required database configuration",
			);
		});
	});

	describe("getTwilioConfig", () => {
		it("throws when required Twilio vars are missing", async () => {
			delete process.env["TWILIO_ACCOUNT_SID"];
			delete process.env["TWILIO_AUTH_TOKEN"];
			delete process.env["TWILIO_WHATSAPP_WEBHOOK_URL"];

			const { getTwilioConfig } = await import("@/lib/config/server");

			expect(() => getTwilioConfig()).toThrow(
				"Missing required Twilio configuration",
			);
		});

		it("returns config when all required vars are set", async () => {
			process.env["TWILIO_ACCOUNT_SID"] = "AC123";
			process.env["TWILIO_AUTH_TOKEN"] = "token123";
			process.env["TWILIO_WHATSAPP_WEBHOOK_URL"] =
				"https://example.com/webhook";
			process.env["TWILIO_MESSAGING_SERVICE_SID"] = "MG123";

			const { getTwilioConfig } = await import("@/lib/config/server");
			const config = getTwilioConfig();

			expect(config.accountSid).toBe("AC123");
			expect(config.authToken).toBe("token123");
			expect(config.whatsappWebhookUrl).toBe("https://example.com/webhook");
			expect(config.messagingServiceSid).toBe("MG123");
			expect(config.hasSender).toBe(true);
		});

		it("returns cached config on subsequent calls", async () => {
			process.env["TWILIO_ACCOUNT_SID"] = "AC123";
			process.env["TWILIO_AUTH_TOKEN"] = "token123";
			process.env["TWILIO_WHATSAPP_WEBHOOK_URL"] =
				"https://example.com/webhook";
			process.env["TWILIO_MESSAGING_SERVICE_SID"] = "MG123";

			const { getTwilioConfig } = await import("@/lib/config/server");
			const config1 = getTwilioConfig();
			const config2 = getTwilioConfig();

			expect(config1).toBe(config2);
		});

		it("sets hasSender true when TWILIO_WHATSAPP_FROM is set", async () => {
			process.env["TWILIO_ACCOUNT_SID"] = "AC123";
			process.env["TWILIO_AUTH_TOKEN"] = "token123";
			process.env["TWILIO_WHATSAPP_WEBHOOK_URL"] =
				"https://example.com/webhook";
			process.env["TWILIO_WHATSAPP_FROM"] = "+1234567890";

			const { getTwilioConfig } = await import("@/lib/config/server");
			const config = getTwilioConfig();

			expect(config.hasSender).toBe(true);
			expect(config.whatsappFrom).toBe("+1234567890");
		});

		it("sets optional fields to null when not provided", async () => {
			process.env["TWILIO_ACCOUNT_SID"] = "AC123";
			process.env["TWILIO_AUTH_TOKEN"] = "token123";
			process.env["TWILIO_WHATSAPP_WEBHOOK_URL"] =
				"https://example.com/webhook";
			process.env["TWILIO_MESSAGING_SERVICE_SID"] = "MG123";
			delete process.env["TWILIO_WHATSAPP_FROM"];
			delete process.env["TWILIO_CONVERSATIONS_AGENT_IDENTITY"];
			delete process.env["TWILIO_WHATSAPP_BUTTONS_CONTENT_SID"];

			const { getTwilioConfig } = await import("@/lib/config/server");
			const config = getTwilioConfig();

			expect(config.whatsappFrom).toBeNull();
			expect(config.conversationsAgentIdentity).toBeNull();
			expect(config.whatsappButtonsContentSid).toBeNull();
		});

		it("sets hasSender false when neither messaging service nor from is set", async () => {
			process.env["TWILIO_ACCOUNT_SID"] = "AC123";
			process.env["TWILIO_AUTH_TOKEN"] = "token123";
			process.env["TWILIO_WHATSAPP_WEBHOOK_URL"] =
				"https://example.com/webhook";
			delete process.env["TWILIO_MESSAGING_SERVICE_SID"];
			delete process.env["TWILIO_WHATSAPP_FROM"];

			const { getTwilioConfig } = await import("@/lib/config/server");
			const config = getTwilioConfig();

			expect(config.hasSender).toBe(false);
		});
	});

	describe("limits export", () => {
		it("exports limits object", async () => {
			const { limits } = await import("@/lib/config/server");

			expect(limits).toHaveProperty("whatsapp");
			expect(limits).toHaveProperty("llm");
		});
	});

	describe("vercelEnv export", () => {
		it("exports vercelEnv from environment", async () => {
			process.env["VERCEL_ENV"] = "production";

			const { vercelEnv } = await import("@/lib/config/server");

			expect(vercelEnv).toBe("production");
		});
	});
});
