/** biome-ignore-all lint/suspicious/useAwait: async interface implementation */
import type { z } from "zod";
import type { EdgeConfigPort } from "../ports";

/**
 * In-memory Edge Config for testing.
 */
export class InMemoryEdgeConfig implements EdgeConfigPort {
	private readonly store = new Map<string, unknown>();

	constructor(initialValues?: Record<string, unknown>) {
		if (initialValues) {
			for (const [key, value] of Object.entries(initialValues)) {
				this.store.set(key, value);
			}
		}
	}

	async getString(key: string): Promise<string | null> {
		const value = this.store.get(key);
		return typeof value === "string" ? value : null;
	}

	async get<T>(key: string, schema: z.ZodType<T>): Promise<T | null> {
		const raw = this.store.get(key);
		if (raw === undefined) {
			return null;
		}

		const parsed = schema.safeParse(raw);
		return parsed.success ? parsed.data : null;
	}

	async isEnabled(flagKey: string): Promise<boolean> {
		return this.store.get(flagKey) === true;
	}

	/** Test helper: set a value */
	set(key: string, value: unknown): void {
		this.store.set(key, value);
	}

	/** Test helper: delete a value */
	delete(key: string): void {
		this.store.delete(key);
	}

	/** Test helper: clear all values */
	clear(): void {
		this.store.clear();
	}

	/** Test helper: get entry count */
	size(): number {
		return this.store.size;
	}
}
