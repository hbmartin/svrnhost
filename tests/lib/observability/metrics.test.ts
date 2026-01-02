import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	getMetrics,
	recordAiLatency,
	recordChatMessage,
	recordHealthCheckLatency,
	recordRateLimitHit,
	recordTokenUsage,
} from "@/lib/observability/metrics";

// Mock OpenTelemetry metrics
const mockRecord = vi.fn();
const mockAdd = vi.fn();

const mockHistogram = {
	record: mockRecord,
};

const mockCounter = {
	add: mockAdd,
};

const mockMeter = {
	createHistogram: vi.fn(() => mockHistogram),
	createCounter: vi.fn(() => mockCounter),
};

vi.mock("@opentelemetry/api", () => ({
	metrics: {
		getMeter: vi.fn(() => mockMeter),
	},
}));

describe("lib/observability/metrics", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("getMetrics", () => {
		it("returns metrics object with all required metrics", () => {
			const metrics = getMetrics();

			expect(metrics.aiResponseLatency).toBeDefined();
			expect(metrics.aiTokensUsed).toBeDefined();
			expect(metrics.rateLimitHits).toBeDefined();
			expect(metrics.chatMessagesProcessed).toBeDefined();
			expect(metrics.healthCheckLatency).toBeDefined();
		});

		it("returns cached metrics on subsequent calls", () => {
			const metrics1 = getMetrics();
			const metrics2 = getMetrics();

			expect(metrics1).toBe(metrics2);
		});
	});

	describe("recordAiLatency", () => {
		it("records latency with model and success attributes", () => {
			recordAiLatency(150, { model: "gpt-4", success: true });

			expect(mockRecord).toHaveBeenCalledWith(150, {
				model: "gpt-4",
				success: true,
			});
		});

		it("records failed latency", () => {
			recordAiLatency(500, { model: "claude", success: false });

			expect(mockRecord).toHaveBeenCalledWith(500, {
				model: "claude",
				success: false,
			});
		});
	});

	describe("recordTokenUsage", () => {
		it("records token usage with model and type", () => {
			recordTokenUsage(1500, { model: "gpt-4", type: "total" });

			expect(mockAdd).toHaveBeenCalledWith(1500, {
				model: "gpt-4",
				type: "total",
			});
		});

		it("records input tokens", () => {
			recordTokenUsage(500, { model: "claude", type: "input" });

			expect(mockAdd).toHaveBeenCalledWith(500, {
				model: "claude",
				type: "input",
			});
		});

		it("records output tokens", () => {
			recordTokenUsage(1000, { model: "gpt-4", type: "output" });

			expect(mockAdd).toHaveBeenCalledWith(1000, {
				model: "gpt-4",
				type: "output",
			});
		});
	});

	describe("recordRateLimitHit", () => {
		it("records rate limit hit with service", () => {
			recordRateLimitHit({ service: "chat" });

			expect(mockAdd).toHaveBeenCalledWith(1, { service: "chat" });
		});

		it("records rate limit hit with userId", () => {
			recordRateLimitHit({ service: "chat", userId: "user-123" });

			expect(mockAdd).toHaveBeenCalledWith(1, {
				service: "chat",
				userId: "user-123",
			});
		});
	});

	describe("recordChatMessage", () => {
		it("records chat message with model", () => {
			recordChatMessage({ model: "chat-model" });

			expect(mockAdd).toHaveBeenCalledWith(1, { model: "chat-model" });
		});

		it("records chat message with userId", () => {
			recordChatMessage({ model: "chat-model", userId: "user-456" });

			expect(mockAdd).toHaveBeenCalledWith(1, {
				model: "chat-model",
				userId: "user-456",
			});
		});
	});

	describe("recordHealthCheckLatency", () => {
		it("records healthy check latency", () => {
			recordHealthCheckLatency(25, { check: "database", status: "healthy" });

			expect(mockRecord).toHaveBeenCalledWith(25, {
				check: "database",
				status: "healthy",
			});
		});

		it("records unhealthy check latency", () => {
			recordHealthCheckLatency(5000, {
				check: "ai_provider",
				status: "unhealthy",
			});

			expect(mockRecord).toHaveBeenCalledWith(5000, {
				check: "ai_provider",
				status: "unhealthy",
			});
		});
	});
});
