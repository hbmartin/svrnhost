import "server-only";

import { Redis } from "@upstash/redis";
import { getRedisConfig } from "@/lib/config/server";

let redisClient: Redis | null = null;

/**
 * Get or create the Upstash Redis client singleton.
 * Uses REST-based client for edge/serverless compatibility.
 * @returns Redis client instance or null if not configured
 */
export function getRedisClient(): Redis | null {
	if (redisClient) {
		return redisClient;
	}

	const config = getRedisConfig();
	if (!config.isConfigured) {
		return null;
	}

	redisClient = new Redis({
		url: config.restUrl,
		token: config.restToken,
	});

	return redisClient;
}

/**
 * Type-safe key builder to prevent collisions and ensure consistency.
 */
export const CacheKeys = {
	/** User lookup by phone number */
	userByPhone: (phone: string) => `user:phone:${phone}` as const,
} as const;

/**
 * Reset the Redis client singleton (for testing).
 */
export function resetRedisClient(): void {
	redisClient = null;
}
