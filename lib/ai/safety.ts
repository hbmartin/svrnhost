/**
 * LLM call safety utilities for WhatsApp responses.
 *
 * Provides:
 * - Strict timeout and retry configuration
 * - Response validation
 * - Fallback responses for invalid/empty AI output
 */

import { LLM_LIMITS } from "@/lib/config/limits";

/**
 * Configuration for LLM calls in WhatsApp context.
 */
export const LLM_CONFIG = {
	/** Timeout in milliseconds. 30 seconds is reasonable for conversational AI. */
	timeoutMs: LLM_LIMITS.timeoutMs,

	/** Maximum retries for transient failures (handled by AI SDK). */
	maxRetries: LLM_LIMITS.maxRetries,

	/** Minimum response message length to be considered valid. */
	minResponseLength: LLM_LIMITS.minResponseLength,
} as const;

/**
 * Professional fallback response when AI fails or returns invalid output.
 * This is sent to the user when we cannot generate a proper response.
 */
export const FALLBACK_RESPONSE =
	"We're experiencing technical difficulties. Please try again shortly.";

/**
 * User-friendly messages for different AI failure types.
 * These provide more context than the generic fallback when appropriate.
 */
export const FAILURE_RESPONSES: Record<AIFailureType, string> = {
	timeout:
		"Your request is taking longer than expected. Please try again in a moment.",
	api_error:
		"Our service is temporarily unavailable. Please try again in a few minutes.",
	invalid_response: FALLBACK_RESPONSE,
	empty_response: FALLBACK_RESPONSE,
	schema_validation_failed: FALLBACK_RESPONSE,
	unknown: FALLBACK_RESPONSE,
};

/**
 * Get the appropriate user-facing message for a failure type.
 */
export function getFailureResponse(failureType: AIFailureType): string {
	return FAILURE_RESPONSES[failureType] ?? FALLBACK_RESPONSE;
}

/**
 * Validate that an AI response is usable for WhatsApp.
 *
 * A valid response must have:
 * - A non-empty message string
 *
 * @returns true if the response is valid and can be sent
 */
export function isValidWhatsAppResponse(response: string): boolean {
	// Must have a message
	if (!response) {
		return false;
	}

	// Message must not be empty or whitespace-only
	if (response.trim().length < LLM_CONFIG.minResponseLength) {
		return false;
	}

	return true;
}

/**
 * Error types for AI failures that require escalation logging.
 */
export type AIFailureType =
	| "timeout"
	| "invalid_response"
	| "empty_response"
	| "schema_validation_failed"
	| "api_error"
	| "unknown";

/**
 * Classify an AI error for logging purposes.
 */
export function classifyAIError(error: unknown): AIFailureType {
	if (error instanceof Error) {
		const message = error.message.toLowerCase();

		if (message.includes("timeout") || message.includes("aborted")) {
			return "timeout";
		}

		if (message.includes("schema") || message.includes("validation")) {
			return "schema_validation_failed";
		}

		if (
			message.includes("api") ||
			message.includes("rate limit") ||
			message.includes("429") ||
			message.includes("500")
		) {
			return "api_error";
		}
	}

	return "unknown";
}

/**
 * PII patterns for redaction in error messages.
 * Order matters: more specific patterns should come before general ones.
 */
const PII_PATTERNS = [
	// WhatsApp IDs (must come before phone patterns to avoid partial matches)
	{ pattern: /\bwa_id[=:]\s*\d{10,}/gi, replacement: "wa_id=[ID_REDACTED]" },
	// SSN pattern (must come before general phone to avoid partial matches)
	{ pattern: /\b\d{3}-\d{2}-\d{4}\b/g, replacement: "[SSN_REDACTED]" },
	// Credit card numbers (basic pattern)
	{
		pattern: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
		replacement: "[CC_REDACTED]",
	},
	// E.164 phone numbers: +1234567890
	{ pattern: /\+\d{10,15}/g, replacement: "[PHONE_REDACTED]" },
	// US phone formats: (123) 456-7890, 123-456-7890, 123.456.7890
	{
		pattern: /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
		replacement: "[PHONE_REDACTED]",
	},
	// Email addresses
	{
		pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
		replacement: "[EMAIL_REDACTED]",
	},
] as const;

/**
 * Redact PII from a string.
 */
export function redactPII(text: string): string {
	let result = text;
	for (const { pattern, replacement } of PII_PATTERNS) {
		result = result.replace(pattern, replacement);
	}
	return result;
}

/**
 * Extract a safe error message for logging (no sensitive data).
 * Redacts PII such as phone numbers, emails, and other sensitive information.
 */
export function getSafeErrorMessage(error: unknown): string {
	let message: string;
	if (error instanceof Error) {
		message = error.message;
	} else {
		message = String(error);
	}
	// Redact PII and truncate
	return redactPII(message).slice(0, 500);
}
