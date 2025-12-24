import type { Geo } from "@vercel/functions";
import { type InferAgentUIMessage, stepCountIs, ToolLoopAgent } from "ai";
import { z } from "zod";
import { myProvider } from "@/lib/ai/providers";
import { systemPrompt, type RequestHints } from "../prompts";
import { getWeather } from "../tools/get-weather";
import { listUpcomingEvents } from "../tools/list-upcoming-events";

/**
 * Call options schema for the chat agent.
 * These options are passed at runtime when calling generate/stream.
 */
export const chatAgentCallOptionsSchema = z.object({
	selectedChatModel: z.enum(["chat-model", "chat-model-reasoning"]),
	requestHints: z.object({
		latitude: z.union([z.string(), z.undefined()]),
		longitude: z.union([z.string(), z.undefined()]),
		city: z.union([z.string(), z.undefined()]),
		country: z.union([z.string(), z.undefined()]),
	}),
});

export type ChatAgentCallOptions = z.infer<typeof chatAgentCallOptionsSchema>;

/**
 * SVRN Chat Agent using AI SDK v6 ToolLoopAgent.
 *
 * This agent:
 * - Handles the complete tool execution loop automatically (up to 5 steps)
 * - Dynamically selects model based on call options
 * - Injects geolocation-aware system prompts
 * - Provides type-safe tools with strict schema validation
 */
export const chatAgent = new ToolLoopAgent({
	// Default model - will be overridden by prepareCall based on options
	model: myProvider.languageModel("chat-model"),

	// Default instructions - will be customized per request in prepareCall
	instructions: "",

	// Available tools with strict mode and input examples
	tools: {
		getWeather,
		listUpcomingEvents,
	},

	// Stop after 5 tool execution steps to prevent runaway loops
	stopWhen: stepCountIs(5),

	// Type-safe call options for dynamic configuration
	callOptionsSchema: chatAgentCallOptionsSchema,

	// Customize model and instructions per request
	prepareCall: ({ options, ...settings }) => ({
		...settings,
		model: myProvider.languageModel(options.selectedChatModel),
		instructions: systemPrompt({
			selectedChatModel: options.selectedChatModel,
			requestHints: options.requestHints as RequestHints,
		}),
	}),
});

/**
 * Inferred UI message type for the chat agent.
 * Use this type in components to get type-safe tool invocation handling.
 *
 * @example
 * ```tsx
 * import type { ChatAgentUIMessage } from '@/lib/ai/agents/chat-agent';
 *
 * function Chat({ messages }: { messages: ChatAgentUIMessage[] }) {
 *   return messages.map((msg) =>
 *     msg.parts.map((part) => {
 *       if (part.type === 'tool-getWeather') {
 *         return <WeatherCard invocation={part} />;
 *       }
 *     })
 *   );
 * }
 * ```
 */
export type ChatAgentUIMessage = InferAgentUIMessage<typeof chatAgent>;

/**
 * Helper to create RequestHints from Vercel geolocation data.
 */
export function createRequestHints(geo: Partial<Geo>): RequestHints {
	return {
		latitude: geo.latitude,
		longitude: geo.longitude,
		city: geo.city,
		country: geo.country,
	};
}
