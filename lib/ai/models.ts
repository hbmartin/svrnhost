export const DEFAULT_CHAT_MODEL: string = "chat-model";

export type ChatModel = {
	id: string;
	name: string;
	description: string;
};

export const chatModels: ChatModel[] = [
	{
		id: "chat-model",
		name: "ChatGPT 4o",
		description:
			"OpenAI's flagship ChatGPT experience for fast, high-quality multimodal replies",
	},
	{
		id: "chat-model-reasoning",
		name: "Claude 3.7 Sonnet",
		description:
			"Anthropic's best Claude for deep reasoning, analysis, and long-context tasks",
	},
];
