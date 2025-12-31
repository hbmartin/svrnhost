import type { InferUITool, UIMessage } from "ai";
import { z } from "zod";
import type { getWeather } from "./ai/tools/get-weather";
import type { listUpcomingEvents } from "./ai/tools/list-upcoming-events";
import type { Suggestion } from "./db/schema";
import type { AppUsage } from "./usage";

export interface DataPart {
	type: "append-message";
	message: string;
}

export const messageMetadataSchema = z.object({
	createdAt: z.string(),
});

export type MessageMetadata = z.infer<typeof messageMetadataSchema>;

type weatherTool = InferUITool<typeof getWeather>;
type listUpcomingEventsTool = InferUITool<typeof listUpcomingEvents>;

export interface ChatTools {
	getWeather: weatherTool;
	listUpcomingEvents: listUpcomingEventsTool;
}

export interface CustomUIDataTypes {
	textDelta: string;
	imageDelta: string;
	sheetDelta: string;
	codeDelta: string;
	suggestion: Suggestion;
	appendMessage: string;
	id: string;
	title: string;
	clear: null;
	finish: null;
	usage: AppUsage;
}

export type ChatMessage = UIMessage<
	MessageMetadata,
	CustomUIDataTypes,
	ChatTools
>;

export interface Attachment {
	name: string;
	url: string;
	contentType: string;
}
