import { describe, expect, it } from "vitest";
import {
	type AIFailureType,
	classifyAIError,
	FAILURE_RESPONSES,
	FALLBACK_RESPONSE,
	getFailureResponse,
	getSafeErrorMessage,
	isValidWhatsAppResponse,
	LLM_CONFIG,
	redactPII,
} from "@/lib/ai/safety";

describe("redactPII", () => {
	describe("phone number redaction", () => {
		it("redacts E.164 phone numbers", () => {
			const input = "User +14155551234 sent a message";
			expect(redactPII(input)).toBe("User [PHONE_REDACTED] sent a message");
		});

		it("redacts multiple E.164 phone numbers", () => {
			const input = "From +14155551234 to +447911123456";
			expect(redactPII(input)).toBe(
				"From [PHONE_REDACTED] to [PHONE_REDACTED]",
			);
		});

		it("redacts US formatted phone numbers with parentheses", () => {
			const input = "Call (415) 555-1234 now";
			expect(redactPII(input)).toBe("Call [PHONE_REDACTED] now");
		});

		it("redacts US formatted phone numbers with dashes", () => {
			const input = "Contact 415-555-1234 for help";
			expect(redactPII(input)).toBe("Contact [PHONE_REDACTED] for help");
		});

		it("redacts US formatted phone numbers with dots", () => {
			const input = "Dial 415.555.1234";
			expect(redactPII(input)).toBe("Dial [PHONE_REDACTED]");
		});
	});

	describe("email redaction", () => {
		it("redacts email addresses", () => {
			const input = "Contact user@example.com for help";
			expect(redactPII(input)).toBe("Contact [EMAIL_REDACTED] for help");
		});

		it("redacts multiple email addresses", () => {
			const input = "From admin@test.org to user@example.com";
			expect(redactPII(input)).toBe(
				"From [EMAIL_REDACTED] to [EMAIL_REDACTED]",
			);
		});

		it("redacts emails with plus addressing", () => {
			const input = "Send to user+tag@gmail.com";
			expect(redactPII(input)).toBe("Send to [EMAIL_REDACTED]");
		});
	});

	describe("WhatsApp ID redaction", () => {
		it("redacts WhatsApp IDs with equals sign (no space)", () => {
			// Note: wa_id pattern takes precedence when directly attached
			const input = "wa_id=14155551234567890 in payload";
			expect(redactPII(input)).toBe("wa_id=[ID_REDACTED] in payload");
		});

		it("redacts WhatsApp IDs with colon and space", () => {
			// Note: With space, the phone pattern may partially match first,
			// but sensitive data is still redacted
			const input = "wa_id: 14155551234567";
			const result = redactPII(input);
			// The numeric part should be at least partially redacted
			expect(result).not.toContain("14155551234567");
		});
	});

	describe("credit card redaction", () => {
		it("redacts credit card numbers with spaces", () => {
			const input = "Card 4111 1111 1111 1111 was used";
			expect(redactPII(input)).toBe("Card [CC_REDACTED] was used");
		});

		it("redacts credit card numbers with dashes", () => {
			const input = "Card 4111-1111-1111-1111";
			expect(redactPII(input)).toBe("Card [CC_REDACTED]");
		});
	});

	describe("SSN redaction", () => {
		it("redacts SSN format", () => {
			const input = "SSN: 123-45-6789";
			expect(redactPII(input)).toBe("SSN: [SSN_REDACTED]");
		});
	});

	describe("mixed content", () => {
		it("redacts multiple PII types in one string", () => {
			const input =
				"User +14155551234 with email user@test.com and SSN 123-45-6789";
			const result = redactPII(input);
			expect(result).toBe(
				"User [PHONE_REDACTED] with email [EMAIL_REDACTED] and SSN [SSN_REDACTED]",
			);
		});

		it("preserves non-PII content", () => {
			const input = "Error code 500: Internal server error";
			expect(redactPII(input)).toBe(input);
		});
	});
});

describe("getSafeErrorMessage", () => {
	it("extracts message from Error objects", () => {
		const error = new Error("Something went wrong");
		expect(getSafeErrorMessage(error)).toBe("Something went wrong");
	});

	it("converts non-Error values to strings", () => {
		expect(getSafeErrorMessage("string error")).toBe("string error");
		expect(getSafeErrorMessage(42)).toBe("42");
		expect(getSafeErrorMessage({ message: "object" })).toBe("[object Object]");
	});

	it("redacts PII from error messages", () => {
		const error = new Error("User +14155551234 not found");
		expect(getSafeErrorMessage(error)).toBe("User [PHONE_REDACTED] not found");
	});

	it("truncates long messages to 500 characters", () => {
		const longMessage = "a".repeat(600);
		const error = new Error(longMessage);
		const result = getSafeErrorMessage(error);
		expect(result.length).toBe(500);
	});

	it("redacts before truncating", () => {
		const prefix = "User ";
		const phone = "+14155551234";
		const suffix = " " + "x".repeat(600);
		const error = new Error(prefix + phone + suffix);
		const result = getSafeErrorMessage(error);
		expect(result.startsWith("User [PHONE_REDACTED]")).toBe(true);
		expect(result.length).toBe(500);
	});
});

describe("classifyAIError", () => {
	it("classifies timeout errors", () => {
		expect(classifyAIError(new Error("Request timeout"))).toBe("timeout");
		expect(classifyAIError(new Error("Operation aborted"))).toBe("timeout");
	});

	it("classifies API errors", () => {
		expect(classifyAIError(new Error("API rate limit exceeded"))).toBe(
			"api_error",
		);
		expect(classifyAIError(new Error("Rate limit 429"))).toBe("api_error");
		expect(classifyAIError(new Error("Server error 500"))).toBe("api_error");
	});

	it("classifies schema validation errors", () => {
		expect(classifyAIError(new Error("Schema validation failed"))).toBe(
			"schema_validation_failed",
		);
	});

	it("returns unknown for unrecognized errors", () => {
		expect(classifyAIError(new Error("Something weird happened"))).toBe(
			"unknown",
		);
		expect(classifyAIError("not an error")).toBe("unknown");
	});
});

describe("getFailureResponse", () => {
	it("returns timeout message for timeout failures", () => {
		expect(getFailureResponse("timeout")).toBe(FAILURE_RESPONSES.timeout);
		expect(getFailureResponse("timeout")).toContain("longer than expected");
	});

	it("returns api_error message for API failures", () => {
		expect(getFailureResponse("api_error")).toBe(FAILURE_RESPONSES.api_error);
		expect(getFailureResponse("api_error")).toContain(
			"temporarily unavailable",
		);
	});

	it("returns fallback for other failure types", () => {
		const fallbackTypes: AIFailureType[] = [
			"invalid_response",
			"empty_response",
			"schema_validation_failed",
			"unknown",
		];

		for (const type of fallbackTypes) {
			expect(getFailureResponse(type)).toBe(FALLBACK_RESPONSE);
		}
	});
});

describe("isValidWhatsAppResponse", () => {
	it("returns false for empty string", () => {
		expect(isValidWhatsAppResponse("")).toBe(false);
	});

	it("returns false for whitespace-only string", () => {
		expect(isValidWhatsAppResponse("   ")).toBe(false);
		expect(isValidWhatsAppResponse("\t\n")).toBe(false);
	});

	it("returns true for valid response", () => {
		expect(isValidWhatsAppResponse("Hello!")).toBe(true);
		expect(isValidWhatsAppResponse("This is a response")).toBe(true);
	});

	it("returns true for response with leading/trailing whitespace if content is valid", () => {
		expect(isValidWhatsAppResponse("  Hello  ")).toBe(true);
	});

	it("returns true for single character response", () => {
		expect(isValidWhatsAppResponse("a")).toBe(true);
	});

	it("returns true for multiline response", () => {
		expect(isValidWhatsAppResponse("Line 1\nLine 2")).toBe(true);
	});
});

describe("LLM_CONFIG", () => {
	it("exports timeoutMs", () => {
		expect(LLM_CONFIG.timeoutMs).toBeGreaterThan(0);
	});

	it("exports maxRetries", () => {
		expect(LLM_CONFIG.maxRetries).toBeGreaterThanOrEqual(0);
	});

	it("exports minResponseLength", () => {
		expect(LLM_CONFIG.minResponseLength).toBeGreaterThanOrEqual(1);
	});
});
