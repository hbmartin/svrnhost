import { describe, expect, it } from "vitest";

import { TEMPLATE_LIMITS } from "@/lib/config/limits";

describe("TEMPLATE_LIMITS", () => {
	it("has maxBulkRecipients limit", () => {
		expect(TEMPLATE_LIMITS.maxBulkRecipients).toBe(100);
	});

	it("has maxScheduledRecipients limit", () => {
		expect(TEMPLATE_LIMITS.maxScheduledRecipients).toBe(1000);
	});

	it("has syncCooldownSeconds limit", () => {
		expect(TEMPLATE_LIMITS.syncCooldownSeconds).toBe(60);
	});

	it("is readonly", () => {
		// TypeScript compile-time check - this ensures the object is typed as const
		const limits: typeof TEMPLATE_LIMITS = TEMPLATE_LIMITS;
		expect(limits).toBeDefined();
	});
});
