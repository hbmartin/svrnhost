import { sql } from "drizzle-orm";
import { getAiConfig } from "@/lib/config/server";
import { db } from "@/lib/db";
import {
	recordHealthCheckLatency,
	runWithRequestContext,
} from "@/lib/observability";

interface HealthCheckResult {
	name: string;
	status: "healthy" | "unhealthy";
	latencyMs?: number;
	error?: string;
}

async function checkDatabase(): Promise<HealthCheckResult> {
	const start = Date.now();
	try {
		await db.execute(sql`SELECT 1`);
		const latencyMs = Date.now() - start;
		recordHealthCheckLatency(latencyMs, {
			check: "database",
			status: "healthy",
		});
		return {
			name: "database",
			status: "healthy",
			latencyMs,
		};
	} catch (error) {
		const latencyMs = Date.now() - start;
		recordHealthCheckLatency(latencyMs, {
			check: "database",
			status: "unhealthy",
		});
		return {
			name: "database",
			status: "unhealthy",
			latencyMs,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

function checkAiProvider(): HealthCheckResult {
	try {
		const config = getAiConfig();
		const hasProvider = config.hasOpenAiKey || config.hasAnthropicKey;

		if (hasProvider) {
			return {
				name: "ai_provider",
				status: "healthy",
			};
		}

		return {
			name: "ai_provider",
			status: "unhealthy",
			error: "No AI provider keys configured",
		};
	} catch (error) {
		return {
			name: "ai_provider",
			status: "unhealthy",
			error: error instanceof Error ? error.message : "Config error",
		};
	}
}

/**
 * Readiness probe endpoint.
 * Checks database connectivity and AI provider configuration.
 * Returns 200 if all checks pass, 503 if any check fails.
 */
export function GET(request: Request) {
	return runWithRequestContext({ request, service: "health" }, async () => {
		const checks = await Promise.all([
			checkDatabase(),
			Promise.resolve(checkAiProvider()),
		]);

		const allHealthy = checks.every((c) => c.status === "healthy");

		return Response.json(
			{
				status: allHealthy ? "ready" : "not_ready",
				timestamp: new Date().toISOString(),
				checks,
			},
			{ status: allHealthy ? 200 : 503 },
		);
	});
}
