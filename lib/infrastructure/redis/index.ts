import "server-only";

export type { RedisCacheAdapterOptions } from "./adapters/cache-adapter";
// Adapters
export { RedisCacheAdapter } from "./adapters/cache-adapter";
export type { UpstashRateLimitOptions } from "./adapters/rate-limit-adapter";
export { UpstashRateLimitAdapter } from "./adapters/rate-limit-adapter";
// Client utilities
export { CacheKeys, getRedisClient, resetRedisClient } from "./client";
// Mocks for testing
export { InMemoryCache } from "./mocks/in-memory-cache";
export { InMemoryRateLimit } from "./mocks/in-memory-rate-limit";
// Types
export type { CachePort, RateLimitPort, RateLimitResult } from "./ports";

import { WHATSAPP_LIMITS } from "@/lib/config/limits";
import { RedisCacheAdapter } from "./adapters/cache-adapter";
import { UpstashRateLimitAdapter } from "./adapters/rate-limit-adapter";
import { getRedisClient } from "./client";
import { InMemoryCache } from "./mocks/in-memory-cache";
import { InMemoryRateLimit } from "./mocks/in-memory-rate-limit";
import type { CachePort, RateLimitPort } from "./ports";

// Singleton instances
let userCacheInstance: CachePort | null = null;
let whatsappRateLimitInstance: RateLimitPort | null = null;

/**
 * Get the user cache instance.
 * Uses Redis if configured, falls back to in-memory.
 */
export function getUserCache(): CachePort {
	if (userCacheInstance) {
		return userCacheInstance;
	}

	const redis = getRedisClient();
	if (redis) {
		userCacheInstance = new RedisCacheAdapter(redis, {
			ttlSeconds: 300, // 5 minutes
			keyPrefix: "user",
		});
	} else {
		userCacheInstance = new InMemoryCache({ ttlMs: 300_000 });
	}

	return userCacheInstance;
}

/**
 * Get the WhatsApp rate limiter instance.
 * Uses Upstash if configured, falls back to in-memory.
 */
export function getWhatsAppRateLimiter(): RateLimitPort {
	if (whatsappRateLimitInstance) {
		return whatsappRateLimitInstance;
	}

	const redis = getRedisClient();
	if (redis) {
		whatsappRateLimitInstance = new UpstashRateLimitAdapter(redis, {
			requests: WHATSAPP_LIMITS.senderRateLimitPerSecond,
			window: "1 s", // 80 requests per second (Twilio limit)
			prefix: "whatsapp",
			analytics: true,
		});
	} else {
		whatsappRateLimitInstance = new InMemoryRateLimit({
			maxRequests: WHATSAPP_LIMITS.senderRateLimitPerSecond,
			windowMs: 1000,
		});
	}

	return whatsappRateLimitInstance;
}

/**
 * Reset all singleton instances.
 * Useful for testing to ensure clean state between tests.
 */
export function resetCacheInstances(): void {
	userCacheInstance = null;
	whatsappRateLimitInstance = null;
}
