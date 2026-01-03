import "server-only";

// Adapters
export { VercelEdgeConfigAdapter } from "./adapters/edge-config-adapter";
// Mocks for testing
export { InMemoryEdgeConfig } from "./mocks/in-memory-config";
// Types
export type { EdgeConfigPort } from "./ports";

import { getEdgeConfigConnectionString } from "@/lib/config/server";
import { VercelEdgeConfigAdapter } from "./adapters/edge-config-adapter";
import { InMemoryEdgeConfig } from "./mocks/in-memory-config";
import type { EdgeConfigPort } from "./ports";

// Singleton instance
let promptConfigInstance: EdgeConfigPort | null = null;

// Fallback prompts for when Edge Config is not configured
const FALLBACK_PROMPTS: Record<string, string> = {};

/**
 * Get the prompt configuration instance.
 * Uses Vercel Edge Config if configured, falls back to in-memory with defaults.
 */
export function getPromptConfig(): EdgeConfigPort {
	if (promptConfigInstance) {
		return promptConfigInstance;
	}

	const connectionString = getEdgeConfigConnectionString();
	if (connectionString) {
		promptConfigInstance = new VercelEdgeConfigAdapter(connectionString);
	} else {
		console.warn(
			"[edge-config] Not configured - falling back to hardcoded prompts",
		);
		promptConfigInstance = new InMemoryEdgeConfig(FALLBACK_PROMPTS);
	}

	return promptConfigInstance;
}

/**
 * Reset the singleton instance.
 * Useful for testing to ensure clean state between tests.
 */
export function resetEdgeConfigInstance(): void {
	promptConfigInstance = null;
}
