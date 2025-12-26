import { describe, expect, it } from "vitest";

import { whatsappResponseSchema } from "@/app/api/whatsapp/types";

describe("whatsappResponseSchema", () => {
	it("accepts message-only response", () => {
		const result = whatsappResponseSchema.safeParse({
			message: "Hello",
		});

		expect(result.success).toBe(true);
	});

	it("accepts response with mediaUrl", () => {
		const result = whatsappResponseSchema.safeParse({
			message: "Check this out",
			mediaUrl: "https://example.com/image.png",
		});

		expect(result.success).toBe(true);
	});

	it("accepts response with location", () => {
		const result = whatsappResponseSchema.safeParse({
			message: "Meet here",
			location: {
				name: "Coffee Shop",
				latitude: 37.7749,
				longitude: -122.4194,
			},
		});

		expect(result.success).toBe(true);
	});

	it("rejects response missing message", () => {
		const result = whatsappResponseSchema.safeParse({
			mediaUrl: "https://example.com/image.png",
		});

		expect(result.success).toBe(false);
	});
});
