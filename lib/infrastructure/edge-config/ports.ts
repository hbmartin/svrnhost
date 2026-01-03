import type { z } from "zod";

/**
 * Edge Config port interface for dynamic configuration.
 * Used for LLM prompts, feature flags, and other configuration
 * that should be updateable without redeployment.
 */
export interface EdgeConfigPort {
	/**
	 * Get a string config value by key.
	 * @returns The value or null if not found
	 */
	getString(key: string): Promise<string | null>;

	/**
	 * Get a typed config value with runtime Zod validation.
	 * @param key Config key
	 * @param schema Zod schema for validation
	 * @returns Validated value or null if not found/invalid
	 */
	get<T>(key: string, schema: z.ZodType<T>): Promise<T | null>;

	/**
	 * Check if a feature flag is enabled.
	 * @param flagKey The feature flag key
	 * @returns true if enabled, false otherwise (fails closed)
	 */
	isEnabled(flagKey: string): Promise<boolean>;
}
