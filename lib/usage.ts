import type { LanguageModelUsage } from "ai";
import type { UsageData } from "tokenlens/helpers";

/**
 * Extended usage details from AI SDK v6.
 * These provide granular token breakdowns for cost optimization.
 *
 * Note: Fields use `| undefined` for exactOptionalPropertyTypes compatibility.
 */
export type ExtendedUsageDetails = {
	/** Detailed breakdown of input tokens */
	inputTokenDetails?:
		| {
				/** Tokens not served from cache */
				noCacheTokens: number | undefined;
				/** Tokens read from provider cache (e.g., Anthropic prompt caching) */
				cacheReadTokens: number | undefined;
				/** Tokens written to provider cache */
				cacheWriteTokens: number | undefined;
		  }
		| undefined;
	/** Detailed breakdown of output tokens */
	outputTokenDetails?:
		| {
				/** Tokens used for text generation */
				textTokens: number | undefined;
				/** Tokens used for reasoning/thinking (Claude, o1, etc.) */
				reasoningTokens: number | undefined;
		  }
		| undefined;
	/** Raw finish reason from the provider (before SDK normalization) */
	rawFinishReason?: string | undefined;
};

// Server-merged usage: base usage + TokenLens summary + optional modelId + extended v6 details
export type AppUsage = LanguageModelUsage &
	UsageData &
	ExtendedUsageDetails & { modelId?: string | undefined };
