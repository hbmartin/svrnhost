import { registerOTel } from "@vercel/otel";

export async function register() {
	// Register OpenTelemetry with Vercel's integration
	// This configures tracing and metrics export to OTLP endpoints
	// Metrics are collected via @opentelemetry/api in lib/observability/metrics.ts
	registerOTel({ serviceName: "ai-chatbot" });

	if (process.env["NEXT_RUNTIME"] === "nodejs") {
		await import("./sentry.server.config");
	}

	if (process.env["NEXT_RUNTIME"] === "edge") {
		await import("./sentry.edge.config");
	}
}
