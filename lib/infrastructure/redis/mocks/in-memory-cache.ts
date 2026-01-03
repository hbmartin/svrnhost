/** biome-ignore-all lint/suspicious/useAwait: async interface implementation */
import type { CachePort } from "../ports";

interface CacheEntry<T> {
	value: T;
	expiresAt: number;
}

/**
 * In-memory cache implementation for unit tests.
 * Supports TTL simulation with fake timers.
 */
export class InMemoryCache implements CachePort {
	private readonly store = new Map<string, CacheEntry<unknown>>();
	private readonly ttlMs: number;

	constructor(options: { ttlMs?: number } = {}) {
		this.ttlMs = options.ttlMs ?? 300_000; // 5 min default
	}

	async get<T>(key: string): Promise<T | null> {
		const entry = this.store.get(key);
		if (!entry) {
			return null;
		}

		if (Date.now() > entry.expiresAt) {
			this.store.delete(key);
			return null;
		}

		return entry.value as T;
	}

	async set<T>(key: string, value: T): Promise<void> {
		this.store.set(key, {
			value,
			expiresAt: Date.now() + this.ttlMs,
		});
	}

	async delete(key: string): Promise<void> {
		this.store.delete(key);
	}

	async getOrSet<T>(
		key: string,
		compute: () => Promise<T | null>,
	): Promise<T | null> {
		const cached = await this.get<T>(key);
		if (cached !== null) {
			return cached;
		}

		const value = await compute();
		if (value !== null) {
			await this.set(key, value);
		}
		return value;
	}

	/** Test helper: clear all entries */
	clear(): void {
		this.store.clear();
	}

	/** Test helper: get entry count */
	size(): number {
		return this.store.size;
	}

	/** Test helper: check if key exists (ignoring TTL for debugging) */
	has(key: string): boolean {
		return this.store.has(key);
	}
}
