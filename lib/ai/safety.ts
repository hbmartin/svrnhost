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
 * Extract a safe error message for logging (no sensitive data).
 */
// TODO: redact PII
export function getSafeErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		// Truncate very long error messages
		return error.message.slice(0, 500);
	}
	return String(error).slice(0, 500);
}
