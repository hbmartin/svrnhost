import { geolocation } from "@vercel/functions";
import {
	convertToModelMessages,
	createUIMessageStream,
	JsonToSseTransformStream,
	smoothStream,
	stepCountIs,
	streamText,
} from "ai";
import { unstable_cache as cache } from "next/cache";
import { after } from "next/server";
import {
	createResumableStreamContext,
	type ResumableStreamContext,
} from "resumable-stream";
import type { ModelCatalog, UsageLike } from "tokenlens/core";
import { fetchModels } from "tokenlens/fetch";
import { getUsage } from "tokenlens/helpers";
import { auth, type UserType } from "@/app/(auth)/auth";
import { createRequestHints } from "@/lib/ai/agents/chat-agent";
import { entitlementsByUserType } from "@/lib/ai/entitlements";
import type { ChatModel } from "@/lib/ai/models";
import { systemPrompt } from "@/lib/ai/prompts";
import { myProvider } from "@/lib/ai/providers";
import { getWeather } from "@/lib/ai/tools/get-weather";
import { listUpcomingEvents } from "@/lib/ai/tools/list-upcoming-events";
import { getAiConfig, vercelEnv } from "@/lib/config/server";
import { isProductionEnvironment } from "@/lib/constants";
import {
	createStreamId,
	getChatById,
	getMessageCountByUserId,
	getMessagesByChatId,
	saveChat,
	saveMessages,
	updateChatLastContextById,
} from "@/lib/db/queries";
import type { DBMessage } from "@/lib/db/schema";
import { ChatSDKError } from "@/lib/errors";
import type { ChatMessage } from "@/lib/types";
import type { AppUsage } from "@/lib/usage";
import { convertToUIMessages, generateUUID } from "@/lib/utils";
import { generateTitleFromUserMessage } from "../../actions";
import { type PostRequestBody, postRequestBodySchema } from "./schema";

export const maxDuration = 60;

let globalStreamContext: ResumableStreamContext | null = null;

const getTokenlensCatalog = cache(
	async (): Promise<ModelCatalog | undefined> => {
		try {
			return await fetchModels();
		} catch (err) {
			console.warn(
				"TokenLens: catalog fetch failed, using default catalog",
				err,
			);
			return; // tokenlens helpers will fall back to defaultCatalog
		}
	},
	["tokenlens-catalog"],
	{ revalidate: 24 * 60 * 60 }, // 24 hours
);

export function getStreamContext() {
	if (!globalStreamContext) {
		try {
			globalStreamContext = createResumableStreamContext({
				waitUntil: after,
			});
		} catch (error: any) {
			if (error.message.includes("REDIS_URL")) {
				console.log(
					" > Resumable streams are disabled due to missing REDIS_URL",
				);
			} else {
				console.error(error);
			}
		}
	}

	return globalStreamContext;
}

export async function POST(request: Request) {
	let requestBody: PostRequestBody;
	let requestMetadata: { chatId?: string; selectedChatModel?: string } = {};
	let sessionUserId: string | undefined;
	let streamId: string | undefined;

	const logChatEvent = (stage: string, props: Record<string, unknown> = {}) => {
		try {
			console.log("[chat:post]", stage, {
				...requestMetadata,
				sessionUserId,
				streamId,
				nodeEnv: process.env.NODE_ENV,
				vercelEnv,
				...props,
			});
		} catch {
			// Logging must never break the handler
		}
	};

	try {
		const json = await request.json();
		requestBody = postRequestBodySchema.parse(json);
	} catch (error) {
		console.error("Error parsing request body", error);
		return new ChatSDKError("bad_request:api").toResponse();
	}

	try {
		const {
			id,
			message,
			selectedChatModel,
		}: {
			id: string;
			message: ChatMessage;
			selectedChatModel: ChatModel["id"];
		} = requestBody;

		requestMetadata = {
			chatId: id,
			selectedChatModel,
		};

		logChatEvent("request_parsed", {
			messagePartCount: message.parts.length,
		});

		const session = await auth();
		sessionUserId = session?.user?.id;

		logChatEvent("session_checked", {
			hasSession: Boolean(session?.user),
			userType: session?.user?.type,
		});

		if (!session?.user) {
			return new ChatSDKError("unauthorized:chat").toResponse();
		}

		const userType: UserType = session.user.type;

		const messageCount = await getMessageCountByUserId({
			id: session.user.id,
			differenceInHours: 24,
		});

		const maxMessagesPerDay =
			entitlementsByUserType[userType].maxMessagesPerDay;

		logChatEvent("quota_checked", {
			messageCount,
			maxMessagesPerDay,
		});

		if (messageCount > maxMessagesPerDay) {
			logChatEvent("rate_limited", { messageCount });
			return new ChatSDKError("rate_limit:chat").toResponse();
		}

		const chat = await getChatById({ id });
		let messagesFromDb: DBMessage[] = [];

		logChatEvent("chat_lookup_complete", {
			chatExists: Boolean(chat),
		});

		if (chat) {
			if (chat.userId !== session.user.id) {
				logChatEvent("chat_access_denied", {
					chatOwnerId: chat.userId,
				});
				return new ChatSDKError("forbidden:chat").toResponse();
			}
			// Only fetch messages if chat already exists
			messagesFromDb = await getMessagesByChatId({ id });
		} else {
			const title = await generateTitleFromUserMessage({
				message,
			});

			await saveChat({
				id,
				userId: session.user.id,
				title,
			});
			// New chat - no need to fetch messages, it's empty
			logChatEvent("chat_created", { titleLength: title.length });
		}

		const uiMessages = [...convertToUIMessages(messagesFromDb), message];

		const geo = geolocation(request);
		const requestHints = createRequestHints(geo);

		await saveMessages({
			messages: [
				{
					chatId: id,
					id: message.id,
					role: "user",
					parts: message.parts,
					attachments: [],
					createdAt: new Date(),
					metadata: null,
				},
			],
		});

		logChatEvent("user_message_saved", {
			messageId: message.id,
			priorMessageCount: messagesFromDb.length,
		});

		const newStreamId = generateUUID();
		streamId = newStreamId;
		await createStreamId({ streamId: newStreamId, chatId: id });

		logChatEvent("stream_id_created", {
			streamId: newStreamId,
		});

		let finalMergedUsage: AppUsage | undefined;

		const stream = createUIMessageStream({
			execute: async ({ writer: dataStream }) => {
				const aiConfig = getAiConfig();
				logChatEvent("starting_stream_text", {
					uiMessageCount: uiMessages.length,
					selectedChatModel,
					hasOpenAiKey: aiConfig.hasOpenAiKey,
					hasAnthropicKey: aiConfig.hasAnthropicKey,
				});

				const result = streamText({
					model: myProvider.languageModel(selectedChatModel),
					system: systemPrompt({ selectedChatModel, requestHints }),
					messages: await convertToModelMessages(uiMessages),
					stopWhen: stepCountIs(5),
					experimental_activeTools: ["getWeather", "listUpcomingEvents"],
					experimental_transform: smoothStream({ chunking: "word" }),
					tools: {
						getWeather,
						listUpcomingEvents,
					},
					experimental_telemetry: {
						isEnabled: isProductionEnvironment,
						functionId: "stream-text",
					},
					onFinish: async ({ usage, rawFinishReason }) => {
						try {
							const providers = await getTokenlensCatalog();
							const modelId =
								myProvider.languageModel(selectedChatModel).modelId;

							// Build extended usage with v6 details
							const extendedUsage = {
								...usage,
								rawFinishReason,
								// inputTokenDetails and outputTokenDetails are already
								// included in the usage object from AI SDK v6
							};

							if (!modelId) {
								finalMergedUsage = extendedUsage;
								dataStream.write({
									type: "data-usage",
									data: finalMergedUsage,
								});
								return;
							}

							if (!providers) {
								finalMergedUsage = extendedUsage;
								dataStream.write({
									type: "data-usage",
									data: finalMergedUsage,
								});
								return;
							}

							const summary = getUsage({
								modelId,
								usage: usage as UsageLike,
								providers,
							});
							finalMergedUsage = {
								...extendedUsage,
								...summary,
								modelId,
							} as AppUsage;
							dataStream.write({ type: "data-usage", data: finalMergedUsage });
						} catch (err) {
							console.warn("TokenLens enrichment failed", err);
							finalMergedUsage = { ...usage, rawFinishReason };
							dataStream.write({ type: "data-usage", data: finalMergedUsage });
						}
					},
				});

				result.consumeStream();

				dataStream.merge(
					result.toUIMessageStream({
						sendReasoning: true,
					}),
				);
			},
			generateId: generateUUID,
			onFinish: async ({ messages }) => {
				await saveMessages({
					messages: messages.map((currentMessage) => ({
						id: currentMessage.id,
						role: currentMessage.role,
						parts: currentMessage.parts,
						createdAt: new Date(),
						attachments: [],
						chatId: id,
						metadata: null,
					})),
				});

				logChatEvent("assistant_messages_saved", {
					assistantMessageCount: messages.length,
				});

				if (finalMergedUsage) {
					try {
						await updateChatLastContextById({
							chatId: id,
							context: finalMergedUsage,
						});
					} catch (err) {
						console.warn("Unable to persist last usage for chat", id, err);
					}
				}
			},
			onError: (streamError) => {
				logChatEvent("ui_stream_error", {
					errorMessage:
						streamError instanceof Error
							? streamError.message
							: String(streamError),
				});
				return "Oops, an error occurred!";
			},
		});

		// const streamContext = getStreamContext();

		// if (streamContext) {
		//   return new Response(
		//     await streamContext.resumableStream(streamId, () =>
		//       stream.pipeThrough(new JsonToSseTransformStream())
		//     )
		//   );
		// }

		return new Response(stream.pipeThrough(new JsonToSseTransformStream()));
	} catch (error) {
		const vercelId = request.headers.get("x-vercel-id");
		const errorContext = {
			vercelId,
			...requestMetadata,
			sessionUserId,
			streamId,
		};

		if (error instanceof ChatSDKError) {
			logChatEvent("handled_chat_sdk_error", {
				errorCode: error.statusCode,
				vercelId,
			});
			return error.toResponse();
		}

		// Check for Vercel AI Gateway credit card error
		if (
			error instanceof Error &&
			error.message?.includes(
				"AI Gateway requires a valid credit card on file to service requests",
			)
		) {
			logChatEvent("gateway_credit_card_error");
			return new ChatSDKError("bad_request:activate_gateway").toResponse();
		}

		console.error("Unhandled error in chat API:", error, errorContext);
		return new ChatSDKError("offline:chat").toResponse();
	}
}
