import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Helper to set up minimal valid env for module loading
function setupMinimalEnv() {
	process.env["POSTGRES_URL"] = "postgres://test:test@localhost:5432/test";
}

describe("lib/ai/providers", () => {
	beforeEach(() => {
		vi.resetModules();
		setupMinimalEnv();
	});

	afterEach(() => {
		vi.unstubAllEnvs();
	});

	describe("myProvider", () => {
		it("exports myProvider in test environment", async () => {
			const { myProvider } = await import("@/lib/ai/providers");
			expect(myProvider).toBeDefined();
		});

		it("uses mock models in test environment", async () => {
			const { myProvider } = await import("@/lib/ai/providers");
			// In test environment, myProvider should use the mock models
			expect(myProvider).toBeDefined();
			// The provider should have languageModels configured
			expect(typeof myProvider.languageModel).toBe("function");
		});
	});

	describe("provider logging", () => {
		it("logs warning when API keys are missing", async () => {
			const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

			// Ensure no API keys are set by deleting them
			delete process.env["OPENAI_API_KEY"];
			delete process.env["ANTHROPIC_API_KEY"];
			delete process.env["AI_GATEWAY_API_KEY"];
			delete process.env["VERCEL_AI_API_KEY"];

			// Import the module to trigger logProviderConfig
			await import("@/lib/ai/providers");

			expect(warnSpy).toHaveBeenCalledWith(
				"[ai:providers] Missing API credentials",
				expect.objectContaining({
					hasOpenAiKey: false,
					hasAnthropicKey: false,
				}),
			);

			warnSpy.mockRestore();
		});

		it("does not log warning when API keys are present", async () => {
			const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

			process.env["OPENAI_API_KEY"] = "test-key";
			process.env["ANTHROPIC_API_KEY"] = "test-key";

			await import("@/lib/ai/providers");

			expect(warnSpy).not.toHaveBeenCalled();

			warnSpy.mockRestore();
		});
	});
});
