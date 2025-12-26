import { describe, expect, it } from "vitest";

import { whatsappResponseSchema } from "@/app/api/whatsapp/types";

describe("whatsappResponseSchema", () => {
	it("accepts buttons with required id and label", () => {
		const result = whatsappResponseSchema.safeParse({
			message: "Hello",
			buttons: [
				{ id: "option-1", label: "Yes", url: null },
				{ id: "option-2", label: "No", url: null },
			],
		});

		expect(result.success).toBe(true);
	});

	it("accepts buttons with url when provided", () => {
		const result = whatsappResponseSchema.safeParse({
			message: "Learn more",
			buttons: [
				{ id: "option-1", label: "Docs", url: "https://example.com" },
			],
		});

		expect(result.success).toBe(true);
	});

	it("rejects buttons missing id", () => {
		const result = whatsappResponseSchema.safeParse({
			message: "Hi",
			buttons: [{ label: "Yes", url: null }],
		});

		expect(result.success).toBe(false);
	});
});
