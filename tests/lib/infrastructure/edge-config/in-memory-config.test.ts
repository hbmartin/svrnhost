import { describe, expect, it } from "vitest";
import { z } from "zod";
import { InMemoryEdgeConfig } from "@/lib/infrastructure/edge-config/mocks/in-memory-config";

describe("InMemoryEdgeConfig", () => {
	describe("constructor", () => {
		it("creates empty store by default", async () => {
			const config = new InMemoryEdgeConfig();
			expect(config.size()).toBe(0);
		});

		it("accepts initial values", async () => {
			const config = new InMemoryEdgeConfig({
				stringKey: "value",
				numberKey: 42,
				boolKey: true,
			});

			expect(config.size()).toBe(3);
			expect(await config.getString("stringKey")).toBe("value");
		});
	});

	describe("getString", () => {
		it("returns string value", async () => {
			const config = new InMemoryEdgeConfig({ key: "value" });
			expect(await config.getString("key")).toBe("value");
		});

		it("returns null for missing key", async () => {
			const config = new InMemoryEdgeConfig();
			expect(await config.getString("missing")).toBeNull();
		});

		it("returns null for non-string value", async () => {
			const config = new InMemoryEdgeConfig({
				number: 42,
				boolean: true,
				object: { nested: "value" },
			});

			expect(await config.getString("number")).toBeNull();
			expect(await config.getString("boolean")).toBeNull();
			expect(await config.getString("object")).toBeNull();
		});
	});

	describe("get with schema", () => {
		it("returns validated object", async () => {
			const schema = z.object({
				name: z.string(),
				count: z.number(),
			});
			const config = new InMemoryEdgeConfig({
				data: { name: "test", count: 42 },
			});

			const result = await config.get("data", schema);
			expect(result).toEqual({ name: "test", count: 42 });
		});

		it("returns null for missing key", async () => {
			const schema = z.object({ name: z.string() });
			const config = new InMemoryEdgeConfig();

			expect(await config.get("missing", schema)).toBeNull();
		});

		it("returns null for invalid schema", async () => {
			const schema = z.object({
				name: z.string(),
				count: z.number(),
			});
			const config = new InMemoryEdgeConfig({
				data: { name: "test" }, // missing count
			});

			expect(await config.get("data", schema)).toBeNull();
		});

		it("validates array types", async () => {
			const schema = z.array(z.string());
			const config = new InMemoryEdgeConfig({
				tags: ["a", "b", "c"],
			});

			const result = await config.get("tags", schema);
			expect(result).toEqual(["a", "b", "c"]);
		});

		it("validates primitive types", async () => {
			const config = new InMemoryEdgeConfig({
				number: 42,
				string: "hello",
				boolean: true,
			});

			expect(await config.get("number", z.number())).toBe(42);
			expect(await config.get("string", z.string())).toBe("hello");
			expect(await config.get("boolean", z.boolean())).toBe(true);
		});
	});

	describe("isEnabled", () => {
		it("returns true for true value", async () => {
			const config = new InMemoryEdgeConfig({ feature: true });
			expect(await config.isEnabled("feature")).toBe(true);
		});

		it("returns false for false value", async () => {
			const config = new InMemoryEdgeConfig({ feature: false });
			expect(await config.isEnabled("feature")).toBe(false);
		});

		it("returns false for missing key", async () => {
			const config = new InMemoryEdgeConfig();
			expect(await config.isEnabled("missing")).toBe(false);
		});

		it("returns false for non-boolean values", async () => {
			const config = new InMemoryEdgeConfig({
				string: "true",
				number: 1,
				object: { enabled: true },
			});

			expect(await config.isEnabled("string")).toBe(false);
			expect(await config.isEnabled("number")).toBe(false);
			expect(await config.isEnabled("object")).toBe(false);
		});
	});

	describe("test helpers", () => {
		it("set() adds or updates value", async () => {
			const config = new InMemoryEdgeConfig();

			config.set("key", "value");
			expect(await config.getString("key")).toBe("value");

			config.set("key", "updated");
			expect(await config.getString("key")).toBe("updated");
		});

		it("delete() removes value", async () => {
			const config = new InMemoryEdgeConfig({ key: "value" });
			expect(await config.getString("key")).toBe("value");

			config.delete("key");
			expect(await config.getString("key")).toBeNull();
		});

		it("clear() removes all values", async () => {
			const config = new InMemoryEdgeConfig({
				key1: "value1",
				key2: "value2",
			});
			expect(config.size()).toBe(2);

			config.clear();
			expect(config.size()).toBe(0);
		});

		it("size() returns entry count", async () => {
			const config = new InMemoryEdgeConfig();
			expect(config.size()).toBe(0);

			config.set("key1", "value1");
			expect(config.size()).toBe(1);

			config.set("key2", "value2");
			expect(config.size()).toBe(2);
		});
	});

	describe("real-world scenarios", () => {
		it("stores system prompts", async () => {
			const config = new InMemoryEdgeConfig({
				svrnHostSystemPrompt: "You are SVRN Host...",
				titlePrompt: "Generate a title...",
			});

			expect(await config.getString("svrnHostSystemPrompt")).toBe(
				"You are SVRN Host...",
			);
			expect(await config.getString("titlePrompt")).toBe("Generate a title...");
		});

		it("stores feature flags", async () => {
			const config = new InMemoryEdgeConfig({
				whatsappEnabled: true,
				debugMode: false,
				maintenanceMode: false,
			});

			expect(await config.isEnabled("whatsappEnabled")).toBe(true);
			expect(await config.isEnabled("debugMode")).toBe(false);
			expect(await config.isEnabled("maintenanceMode")).toBe(false);
		});

		it("stores rate limit configuration", async () => {
			const schema = z.object({
				requestsPerSecond: z.number(),
				burstSize: z.number(),
			});

			const config = new InMemoryEdgeConfig({
				whatsappRateLimit: {
					requestsPerSecond: 80,
					burstSize: 80,
				},
			});

			const limits = await config.get("whatsappRateLimit", schema);
			expect(limits).toEqual({
				requestsPerSecond: 80,
				burstSize: 80,
			});
		});
	});
});
