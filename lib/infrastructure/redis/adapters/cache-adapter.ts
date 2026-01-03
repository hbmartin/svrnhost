/** biome-ignore-all lint/suspicious/useAwait: tracing callbacks return Promises */
import "server-only";

import { SpanStatusCode, trace } from "@opentelemetry/api";
import type { Redis } from "@upstash/redis";
import type { CachePort } from "../ports";

const tracer = trace.getTracer("redis-cache");

/** Default TTL for cached values: 5 minutes */
const DEFAULT_TTL_SECONDS = 300;

export interface RedisCacheAdapterOptions {
	/** TTL in seconds for cached values. Default: 300 (5 minutes) */
	ttlSeconds?: number;
	/** Key prefix for namespacing. Omit trailing colon. */
	keyPrefix?: string;
}

/**
 * Redis-backed cache adapter implementing CachePort.
 * Encapsulates all Redis-specific logic (TTLs, keys, serialization).
 * Fails open on errors (returns null rather than throwing).
 */
export class RedisCacheAdapter implements CachePort {
	private readonly redis: Redis;
	private readonly ttlSeconds: number;
	private readonly keyPrefix: string;

	constructor(redis: Redis, options: RedisCacheAdapterOptions = {}) {
		this.redis = redis;
		this.ttlSeconds = options.ttlSeconds ?? DEFAULT_TTL_SECONDS;
		this.keyPrefix = options.keyPrefix ?? "";
	}

	private buildKey(key: string): string {
		return this.keyPrefix ? `${this.keyPrefix}:${key}` : key;
	}

	async get<T>(key: string): Promise<T | null> {
		const fullKey = this.buildKey(key);

		return tracer.startActiveSpan("redis.get", async (span) => {
			span.setAttribute("cache.key", fullKey);

			try {
				const value = await this.redis.get<T>(fullKey);
				span.setAttribute("cache.hit", value !== null);
				span.setStatus({ code: SpanStatusCode.OK });
				return value;
			} catch (error) {
				span.recordException(error as Error);
				span.setStatus({ code: SpanStatusCode.ERROR });
				// Fail open: return null on cache errors
				return null;
			} finally {
				span.end();
			}
		});
	}

	async set<T>(key: string, value: T): Promise<void> {
		const fullKey = this.buildKey(key);

		return tracer.startActiveSpan("redis.set", async (span) => {
			span.setAttribute("cache.key", fullKey);
			span.setAttribute("cache.ttl_seconds", this.ttlSeconds);

			try {
				await this.redis.set(fullKey, value, { ex: this.ttlSeconds });
				span.setStatus({ code: SpanStatusCode.OK });
			} catch (error) {
				span.recordException(error as Error);
				span.setStatus({ code: SpanStatusCode.ERROR });
				// Fail open: don't throw on cache write errors
			} finally {
				span.end();
			}
		});
	}

	async delete(key: string): Promise<void> {
		const fullKey = this.buildKey(key);

		return tracer.startActiveSpan("redis.delete", async (span) => {
			span.setAttribute("cache.key", fullKey);

			try {
				await this.redis.del(fullKey);
				span.setStatus({ code: SpanStatusCode.OK });
			} catch (error) {
				span.recordException(error as Error);
				span.setStatus({ code: SpanStatusCode.ERROR });
			} finally {
				span.end();
			}
		});
	}

	async getOrSet<T>(
		key: string,
		compute: () => Promise<T | null>,
	): Promise<T | null> {
		const fullKey = this.buildKey(key);

		return tracer.startActiveSpan("redis.getOrSet", async (span) => {
			span.setAttribute("cache.key", fullKey);

			try {
				// Try cache first
				const cached = await this.get<T>(key);
				if (cached !== null) {
					span.setAttribute("cache.hit", true);
					span.setStatus({ code: SpanStatusCode.OK });
					return cached;
				}

				span.setAttribute("cache.hit", false);

				// Compute value
				const value = await compute();

				// Cache non-null values (fire-and-forget)
				if (value !== null) {
					this.set(key, value).catch(() => {
						// Silently ignore cache write failures
					});
				}

				span.setStatus({ code: SpanStatusCode.OK });
				return value;
			} catch (error) {
				span.recordException(error as Error);
				span.setStatus({ code: SpanStatusCode.ERROR });
				throw error; // Re-throw compute errors (those are real failures)
			} finally {
				span.end();
			}
		});
	}
}
