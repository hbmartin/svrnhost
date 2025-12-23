import "server-only";

import { z } from "zod";
import { isTestEnvironment } from "@/lib/constants";
import { LLM_LIMITS, WHATSAPP_LIMITS } from "./limits";

const envSchema = z
	.object({
		NODE_ENV: z.string().optional(),
		VERCEL_ENV: z.string().optional(),
		SKIP_ENV_VALIDATION: z.string().optional(),

		TWILIO_ACCOUNT_SID: z.string().min(1).optional(),
		TWILIO_AUTH_TOKEN: z.string().min(1).optional(),
		TWILIO_WHATSAPP_WEBHOOK_URL: z.string().trim().url().optional(),
		TWILIO_MESSAGING_SERVICE_SID: z.string().min(1).optional(),
		TWILIO_WHATSAPP_FROM: z.string().min(1).optional(),
		TWILIO_CONVERSATIONS_AGENT_IDENTITY: z.string().min(1).optional(),
		TWILIO_WHATSAPP_BUTTONS_CONTENT_SID: z.string().min(1).optional(),

		OPENAI_API_KEY: z.string().min(1).optional(),
		ANTHROPIC_API_KEY: z.string().min(1).optional(),
		AI_GATEWAY_API_KEY: z.string().min(1).optional(),
		VERCEL_AI_API_KEY: z.string().min(1).optional(),
	})
	.passthrough();

function formatZodError(error: z.ZodError) {
	return error.issues
		.map((issue) => `${issue.path.join(".")}: ${issue.message}`)
		.join("; ");
}

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
	throw new Error(
		`Invalid environment configuration: ${formatZodError(parsedEnv.error)}`,
	);
}

const env = parsedEnv.data;
const nodeEnv = env.NODE_ENV ?? process.env.NODE_ENV;
const isTestLike = isTestEnvironment || nodeEnv === "test";
const shouldEnforce = env.SKIP_ENV_VALIDATION !== "true" && !isTestLike;

export interface TwilioConfig {
	accountSid: string;
	authToken: string;
	whatsappWebhookUrl: string;
	messagingServiceSid: string | null;
	whatsappFrom: string | null;
	conversationsAgentIdentity: string | null;
	whatsappButtonsContentSid: string | null;
	hasSender: boolean;
}

export interface AiConfig {
	openAiApiKey: string | null;
	anthropicApiKey: string | null;
	aiGatewayApiKey: string | null;
	hasOpenAiKey: boolean;
	hasAnthropicKey: boolean;
}

let cachedTwilioConfig: TwilioConfig | null = null;
let cachedAiConfig: AiConfig | null = null;

export function getTwilioConfig(): TwilioConfig {
	if (cachedTwilioConfig) {
		return cachedTwilioConfig;
	}

	const missing: string[] = [];
	const hasSender = Boolean(
		env.TWILIO_MESSAGING_SERVICE_SID || env.TWILIO_WHATSAPP_FROM,
	);

	if (!env.TWILIO_ACCOUNT_SID) {
		missing.push("TWILIO_ACCOUNT_SID");
	}
	if (!env.TWILIO_AUTH_TOKEN) {
		missing.push("TWILIO_AUTH_TOKEN");
	}
	if (!env.TWILIO_WHATSAPP_WEBHOOK_URL) {
		missing.push("TWILIO_WHATSAPP_WEBHOOK_URL");
	}
	if (!hasSender) {
		missing.push("TWILIO_MESSAGING_SERVICE_SID or TWILIO_WHATSAPP_FROM");
	}

	if (missing.length > 0 && shouldEnforce) {
		throw new Error(
			`Missing Twilio configuration: ${missing.join(", ")}`,
		);
	}

	cachedTwilioConfig = {
		accountSid: env.TWILIO_ACCOUNT_SID ?? "",
		authToken: env.TWILIO_AUTH_TOKEN ?? "",
		whatsappWebhookUrl: env.TWILIO_WHATSAPP_WEBHOOK_URL ?? "",
		messagingServiceSid: env.TWILIO_MESSAGING_SERVICE_SID ?? null,
		whatsappFrom: env.TWILIO_WHATSAPP_FROM ?? null,
		conversationsAgentIdentity: env.TWILIO_CONVERSATIONS_AGENT_IDENTITY ?? null,
		whatsappButtonsContentSid: env.TWILIO_WHATSAPP_BUTTONS_CONTENT_SID ?? null,
		hasSender,
	};

	return cachedTwilioConfig;
}

export function getAiConfig(): AiConfig {
	if (cachedAiConfig) {
		return cachedAiConfig;
	}

	const aiGatewayApiKey =
		env.AI_GATEWAY_API_KEY ?? env.VERCEL_AI_API_KEY ?? null;
	const hasOpenAiKey = Boolean(env.OPENAI_API_KEY || aiGatewayApiKey);
	const hasAnthropicKey = Boolean(env.ANTHROPIC_API_KEY || aiGatewayApiKey);
	const missing: string[] = [];

	if (!hasOpenAiKey) {
		missing.push("OPENAI_API_KEY or AI_GATEWAY_API_KEY");
	}
	if (!hasAnthropicKey) {
		missing.push("ANTHROPIC_API_KEY or AI_GATEWAY_API_KEY");
	}

	if (missing.length > 0 && shouldEnforce) {
		throw new Error(
			`Missing AI configuration: ${missing.join(", ")}`,
		);
	}

	cachedAiConfig = {
		openAiApiKey: env.OPENAI_API_KEY ?? null,
		anthropicApiKey: env.ANTHROPIC_API_KEY ?? null,
		aiGatewayApiKey,
		hasOpenAiKey,
		hasAnthropicKey,
	};

	return cachedAiConfig;
}

export const limits = {
	whatsapp: WHATSAPP_LIMITS,
	llm: LLM_LIMITS,
} as const;
