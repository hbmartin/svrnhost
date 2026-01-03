/**
 * Cache port interface - domain code depends only on this abstraction.
 * TTLs and implementation details are encapsulated in adapters.
 */
export interface CachePort {
	/**
	 * Get a cached value by key.
	 * @returns The cached value or null if not found/expired
	 */
	get<T>(key: string): Promise<T | null>;

	/**
	 * Set a value in cache. TTL is determined by the adapter.
	 */
	set<T>(key: string, value: T): Promise<void>;

	/**
	 * Delete a cached value.
	 */
	delete(key: string): Promise<void>;

	/**
	 * Cache-aside pattern: get from cache or compute and cache the result.
	 * @param key Cache key
	 * @param compute Function to compute value on cache miss
	 * @returns Cached or computed value
	 */
	getOrSet<T>(key: string, compute: () => Promise<T | null>): Promise<T | null>;
}

/**
 * Rate limit result from a limit check.
 */
export interface RateLimitResult {
	/** Whether the request is allowed */
	success: boolean;
	/** Remaining requests in window (for headers) */
	remaining: number;
	/** Unix timestamp when limit resets */
	reset: number;
	/** Pending analytics promise to use with waitUntil in serverless */
	pending?: Promise<void>;
}

/**
 * Rate limiter port interface - abstracts over rate limiting strategy.
 */
export interface RateLimitPort {
	/**
	 * Check rate limit for a key.
	 * @param key Unique identifier (e.g., user ID, IP address)
	 * @returns Result with success status and metadata
	 */
	limit(key: string): Promise<RateLimitResult>;
}
