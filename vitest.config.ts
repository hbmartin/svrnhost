import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "."),
		},
	},
	test: {
		environment: "jsdom",
		setupFiles: ["./tests/setup.ts"],
		clearMocks: true,
		restoreMocks: true,
		include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
		exclude: ["node_modules", "dist", "build", "lib/ai/models.test.ts"],
		coverage: {
			provider: "v8",
			reporter: ["text", "lcov", "html"],
			reportsDirectory: "coverage",
			exclude: ["tests/**", "node_modules/**"],
		},
	},
});
