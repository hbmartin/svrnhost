import { anthropic } from "@ai-sdk/anthropic";
import { devToolsMiddleware } from "@ai-sdk/devtools";
import { openai } from "@ai-sdk/openai";
import {
	customProvider,
	defaultSettingsMiddleware,
	wrapLanguageModel,
} from "ai";
import { getAiConfig } from "@/lib/config/server";
import { isDevelopmentEnvironment, isTestEnvironment } from "../constants";

let hasLoggedProviderConfig = false;

const logProviderConfig = () => {
	if (hasLoggedProviderConfig) {
		return;
	}

	const aiConfig = getAiConfig();
	const providerConfigSnapshot = {
		nodeEnv: process.env.NODE_ENV,
		hasOpenAiKey: aiConfig.hasOpenAiKey,
		hasAnthropicKey: aiConfig.hasAnthropicKey,
		hasVercelAiKey: Boolean(aiConfig.aiGatewayApiKey),
	};

	if (
		!providerConfigSnapshot.hasOpenAiKey ||
		!providerConfigSnapshot.hasAnthropicKey
	) {
		console.warn(
			"[ai:providers] Missing API credentials",
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
				"chat-model": wrapLanguageModel({
					model: openai.languageModel("gpt-5-mini"),
					middleware: isDevelopmentEnvironment ? devToolsMiddleware() : [],
				}),
				"chat-model-reasoning": wrapLanguageModel({
					model: anthropic.languageModel("claude-haiku-4-5"),
					middleware: [
						defaultSettingsMiddleware({
							settings: {
								providerOptions: {
									anthropic: {
										thinking: { type: "enabled" },
										sendReasoning: true,
									},
								},
							},
						}),
						...(isDevelopmentEnvironment ? [devToolsMiddleware()] : []),
					],
				}),
				"title-model": wrapLanguageModel({
					model: openai.languageModel("gpt-4o-mini"),
					middleware: isDevelopmentEnvironment ? devToolsMiddleware() : [],
				}),
				"artifact-model": wrapLanguageModel({
					model: openai.languageModel("gpt-4o-mini"),
					middleware: isDevelopmentEnvironment ? devToolsMiddleware() : [],
				}),
			},
		});
