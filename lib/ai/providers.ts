import { anthropic } from "@ai-sdk/anthropic";
import { openai } from "@ai-sdk/openai";
import {
  customProvider,
  defaultSettingsMiddleware,
  wrapLanguageModel,
} from "ai";
import { isTestEnvironment } from "../constants";

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
        "chat-model": openai.languageModel("chatgpt-4o-latest"),
        "chat-model-reasoning": wrapLanguageModel({
          model: anthropic.languageModel("claude-3-7-sonnet-latest"),
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
