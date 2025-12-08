import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import {
	customProvider,
	defaultSettingsMiddleware,
	wrapLanguageModel,
} from "ai";
import { isTestEnvironment } from "../constants";

let hasLoggedProviderConfig = false;

const logProviderConfig = () => {
	if (hasLoggedProviderConfig) {
		return;
	}

	const providerConfigSnapshot = {
		nodeEnv: process.env.NODE_ENV,
		hasOpenAiKey: Boolean(process.env.OPENAI_API_KEY),
		hasAnthropicKey: Boolean(process.env.ANTHROPIC_API_KEY),
		hasVercelAiKey: Boolean(
			process.env.AI_GATEWAY_API_KEY ?? process.env.VERCEL_AI_API_KEY,
		),
	};

	if (
		!providerConfigSnapshot.hasOpenAiKey ||
		!providerConfigSnapshot.hasAnthropicKey
	) {
		console.warn(
			"[ai:providers] Missing API credentials",
			providerConfigSnapshot,
		);
	} else {
		console.log(
			"[ai:providers] Provider credentials detected",
			providerConfigSnapshot,
		);
	}

	hasLoggedProviderConfig = true;
};

logProviderConfig();

export const myProvider = isTestEnvironment
	? (() => {
			const {
				artifactModel,
				chatModel,
				reasoningModel,
				titleModel,
			} = require("./models.mock");
			return customProvider({
				languageModels: {
					"chat-model": chatModel,
					"chat-model-reasoning": reasoningModel,
					"title-model": titleModel,
					"artifact-model": artifactModel,
				},
			});
		})()
	: customProvider({
			languageModels: {
				"chat-model": openai.languageModel("gpt-5-mini"),
				"chat-model-reasoning": wrapLanguageModel({
					model: anthropic.languageModel("claude-haiku-4-5"),
					middleware: defaultSettingsMiddleware({
						settings: {
							providerOptions: {
								anthropic: {
									thinking: { type: "enabled" },
									sendReasoning: true,
								},
							},
						},
					}),
				}),
				"title-model": openai.languageModel("gpt-4o-mini"),
				"artifact-model": openai.languageModel("gpt-4o-mini"),
			},
		});
