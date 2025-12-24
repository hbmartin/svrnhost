import { describe, expect, it } from "vitest";
import {
	getRequestPromptFromHints,
	type RequestHints,
	svrnHostSystemPrompt,
	systemPrompt,
	titlePrompt,
} from "@/lib/ai/prompts";

describe("lib/ai/prompts", () => {
	describe("svrnHostSystemPrompt", () => {
		it("is defined and non-empty", () => {
			expect(svrnHostSystemPrompt).toBeDefined();
			expect(svrnHostSystemPrompt.length).toBeGreaterThan(0);
		});

		it("contains SVRN branding", () => {
			expect(svrnHostSystemPrompt).toContain("SVRN Host");
			expect(svrnHostSystemPrompt).toContain("Sovereign Voice");
		});
	});

	describe("getRequestPromptFromHints", () => {
		it("formats request hints into prompt string", () => {
			const hints: RequestHints = {
				latitude: "40.7128",
				longitude: "-74.0060",
				city: "New York",
				country: "US",
			};

			const result = getRequestPromptFromHints(hints);

			expect(result).toContain("lat: 40.7128");
			expect(result).toContain("lon: -74.0060");
			expect(result).toContain("city: New York");
			expect(result).toContain("country: US");
		});

		it("handles undefined values", () => {
			const hints: RequestHints = {
				latitude: undefined,
				longitude: undefined,
				city: undefined,
				country: undefined,
			};

			const result = getRequestPromptFromHints(hints);

			expect(result).toContain("lat: undefined");
			expect(result).toContain("lon: undefined");
			expect(result).toContain("city: undefined");
			expect(result).toContain("country: undefined");
		});
	});

	describe("systemPrompt", () => {
		const defaultHints: RequestHints = {
			latitude: "40.7128",
			longitude: "-74.0060",
			city: "New York",
			country: "US",
		};

		it("includes system prompt for chat-model", () => {
			const result = systemPrompt({
				selectedChatModel: "chat-model",
				requestHints: defaultHints,
			});

			expect(result).toContain("SVRN Host");
			expect(result).toContain("city: New York");
		});

		it("includes system prompt for chat-model-reasoning", () => {
			const result = systemPrompt({
				selectedChatModel: "chat-model-reasoning",
				requestHints: defaultHints,
			});

			expect(result).toContain("SVRN Host");
			expect(result).toContain("city: New York");
		});

		it("includes location information in prompt", () => {
			const result = systemPrompt({
				selectedChatModel: "chat-model",
				requestHints: defaultHints,
			});

			expect(result).toContain("About the origin of user's request");
			expect(result).toContain("lat: 40.7128");
		});
	});

	describe("titlePrompt", () => {
		it("is defined and non-empty", () => {
			expect(titlePrompt).toBeDefined();
			expect(titlePrompt.length).toBeGreaterThan(0);
		});

		it("mentions character limit", () => {
			expect(titlePrompt).toContain("80 characters");
		});

		it("mentions title generation purpose", () => {
			expect(titlePrompt).toContain("generate a short title");
		});
	});
});
