import {
	type Counter,
	type Histogram,
	type Meter,
	metrics,
} from "@opentelemetry/api";

const METER_NAME = "ai-chatbot";

let meter: Meter | null = null;

interface AppMetrics {
	aiResponseLatency: Histogram;
	aiTokensUsed: Counter;
	rateLimitHits: Counter;
	chatMessagesProcessed: Counter;
	healthCheckLatency: Histogram;
}

let appMetrics: AppMetrics | null = null;

/**
 * Get or create the meter instance.
 * Uses OpenTelemetry's global meter provider (configured in instrumentation.ts).
 */
function getMeter(): Meter {
	if (!meter) {
		meter = metrics.getMeter(METER_NAME);
	}
	return meter;
}

/**
 * Get application metrics.
 * Lazily creates metric instruments on first access.
 */
export function getMetrics(): AppMetrics {
	if (appMetrics) {
		return appMetrics;
	}

	const m = getMeter();

	appMetrics = {
		aiResponseLatency: m.createHistogram("ai.response.latency_ms", {
			description: "AI response generation latency in milliseconds",
			unit: "ms",
		}),

		aiTokensUsed: m.createCounter("ai.tokens.used", {
			description: "Total AI tokens consumed",
			unit: "tokens",
		}),

		rateLimitHits: m.createCounter("rate_limit.hits", {
			description: "Number of rate limit hits",
		}),

		chatMessagesProcessed: m.createCounter("chat.messages.processed", {
			description: "Total chat messages processed",
		}),

		healthCheckLatency: m.createHistogram("health.check.latency_ms", {
			description: "Health check latency",
			unit: "ms",
		}),
	};

	return appMetrics;
}

/**
 * Record AI response latency.
 */
export function recordAiLatency(
	latencyMs: number,
	attributes: { model: string; success: boolean },
): void {
	getMetrics().aiResponseLatency.record(latencyMs, attributes);
}

/**
 * Record AI token usage.
 */
export function recordTokenUsage(
	tokens: number,
	attributes: { model: string; type: "input" | "output" | "total" },
): void {
	getMetrics().aiTokensUsed.add(tokens, attributes);
}

/**
 * Record a rate limit hit.
 */
export function recordRateLimitHit(attributes: {
	service: string;
	userId?: string;
}): void {
	getMetrics().rateLimitHits.add(1, attributes);
}

/**
 * Record a processed chat message.
 */
export function recordChatMessage(attributes: {
	model: string;
	userId?: string;
}): void {
	getMetrics().chatMessagesProcessed.add(1, attributes);
}

/**
 * Record health check latency.
 */
export function recordHealthCheckLatency(
	latencyMs: number,
	attributes: { check: string; status: "healthy" | "unhealthy" },
): void {
	getMetrics().healthCheckLatency.record(latencyMs, attributes);
}
