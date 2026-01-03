/** biome-ignore-all lint/suspicious/useAwait: tracing callbacks return Promises */
import "server-only";

import { SpanStatusCode, trace } from "@opentelemetry/api";
import { createClient, type EdgeConfigClient } from "@vercel/edge-config";
import type { z } from "zod";
import type { EdgeConfigPort } from "../ports";

const tracer = trace.getTracer("edge-config");

/**
 * Vercel Edge Config adapter implementing EdgeConfigPort.
 * Provides ultra-fast reads from Vercel's edge network.
 * Used for LLM prompts, feature flags, and configuration.
 */
export class VercelEdgeConfigAdapter implements EdgeConfigPort {
	private readonly client: EdgeConfigClient;

	constructor(connectionString?: string) {
		this.client = createClient(connectionString);
	}

	async getString(key: string): Promise<string | null> {
		return tracer.startActiveSpan("edgeconfig.get", async (span) => {
			span.setAttribute("edgeconfig.key", key);

			try {
				const value = await this.client.get<string>(key);
				span.setAttribute("edgeconfig.hit", value !== undefined);
				span.setStatus({ code: SpanStatusCode.OK });
				return value ?? null;
			} catch (error) {
				span.recordException(error as Error);
				span.setStatus({ code: SpanStatusCode.ERROR });
				return null;
			} finally {
				span.end();
			}
		});
	}

	async get<T>(key: string, schema: z.ZodType<T>): Promise<T | null> {
		return tracer.startActiveSpan("edgeconfig.getTyped", async (span) => {
			span.setAttribute("edgeconfig.key", key);

			try {
				const raw = await this.client.get(key);
				if (raw === undefined) {
					span.setAttribute("edgeconfig.hit", false);
					span.setStatus({ code: SpanStatusCode.OK });
					return null;
				}

				span.setAttribute("edgeconfig.hit", true);
				const parsed = schema.safeParse(raw);

				if (!parsed.success) {
					span.setAttribute("edgeconfig.validation_error", true);
					console.error(
						`[edge-config] Validation failed for ${key}:`,
						parsed.error.message,
					);
					span.setStatus({ code: SpanStatusCode.OK });
					return null;
				}

				span.setStatus({ code: SpanStatusCode.OK });
				return parsed.data;
			} catch (error) {
				span.recordException(error as Error);
				span.setStatus({ code: SpanStatusCode.ERROR });
				return null;
			} finally {
				span.end();
			}
		});
	}

	async isEnabled(flagKey: string): Promise<boolean> {
		return tracer.startActiveSpan("edgeconfig.flag", async (span) => {
			span.setAttribute("edgeconfig.flag", flagKey);

			try {
				const value = await this.client.get<boolean>(flagKey);
				const enabled = value === true;
				span.setAttribute("edgeconfig.enabled", enabled);
				span.setStatus({ code: SpanStatusCode.OK });
				return enabled;
			} catch (error) {
				span.recordException(error as Error);
				span.setStatus({ code: SpanStatusCode.ERROR });
				// Fail closed for feature flags
				return false;
			} finally {
				span.end();
			}
		});
	}
}
