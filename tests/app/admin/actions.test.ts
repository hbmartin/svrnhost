import { describe, expect, it } from "vitest";

/**
 * E.164 phone number validation regex (same as in actions.ts).
 * Format: + followed by 1-15 digits (country code + subscriber number)
 */
const E164_PHONE_REGEX = /^\+[1-9]\d{1,14}$/;

describe("E.164 Phone Number Validation", () => {
	describe("valid phone numbers", () => {
		it("accepts US phone numbers", () => {
			expect(E164_PHONE_REGEX.test("+14155551234")).toBe(true);
			expect(E164_PHONE_REGEX.test("+12025551234")).toBe(true);
		});

		it("accepts UK phone numbers", () => {
			expect(E164_PHONE_REGEX.test("+447911123456")).toBe(true);
		});

		it("accepts German phone numbers", () => {
			expect(E164_PHONE_REGEX.test("+491701234567")).toBe(true);
		});

		it("accepts Indian phone numbers", () => {
			expect(E164_PHONE_REGEX.test("+919876543210")).toBe(true);
		});

		it("accepts minimum length (2 digits after +)", () => {
			expect(E164_PHONE_REGEX.test("+11")).toBe(true);
		});

		it("accepts maximum length (15 digits after +)", () => {
			expect(E164_PHONE_REGEX.test("+123456789012345")).toBe(true);
		});
	});

	describe("invalid phone numbers", () => {
		it("rejects numbers without plus sign", () => {
			expect(E164_PHONE_REGEX.test("14155551234")).toBe(false);
		});

		it("rejects numbers starting with 0", () => {
			expect(E164_PHONE_REGEX.test("+0123456789")).toBe(false);
		});

		it("rejects numbers with only plus sign", () => {
			expect(E164_PHONE_REGEX.test("+")).toBe(false);
		});

		it("rejects numbers that are too long (>15 digits)", () => {
			expect(E164_PHONE_REGEX.test("+1234567890123456")).toBe(false);
		});

		it("rejects numbers with letters", () => {
			expect(E164_PHONE_REGEX.test("+1415555CALL")).toBe(false);
		});

		it("rejects numbers with spaces", () => {
			expect(E164_PHONE_REGEX.test("+1 415 555 1234")).toBe(false);
		});

		it("rejects numbers with dashes", () => {
			expect(E164_PHONE_REGEX.test("+1-415-555-1234")).toBe(false);
		});

		it("rejects numbers with parentheses", () => {
			expect(E164_PHONE_REGEX.test("+1(415)5551234")).toBe(false);
		});

		it("rejects empty string", () => {
			expect(E164_PHONE_REGEX.test("")).toBe(false);
		});

		it("rejects local format numbers", () => {
			expect(E164_PHONE_REGEX.test("(415) 555-1234")).toBe(false);
			expect(E164_PHONE_REGEX.test("415-555-1234")).toBe(false);
		});
	});
});
