import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({
	path: ".env.local",
});

const postgresUrl = process.env["POSTGRES_URL"];
if (!postgresUrl) {
	throw new Error(
		"Missing required POSTGRES_URL environment variable for drizzle-kit",
	);
}

export default defineConfig({
	schema: "./lib/db/schema.ts",
	out: "./lib/db/migrations",
	dialect: "postgresql",
	dbCredentials: {
		url: postgresUrl,
	},
});
