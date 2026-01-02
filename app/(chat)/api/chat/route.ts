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
import { entitlementsByUserType } from "@/lib/ai/entitlements";
import type { ChatModel } from "@/lib/ai/models";
import { type RequestHints, systemPrompt } from "@/lib/ai/prompts";
import { myProvider } from "@/lib/ai/providers";
import { getWeather } from "@/lib/ai/tools/get-weather";
import { listUpcomingEvents } from "@/lib/ai/tools/list-upcoming-events";
import { getAiConfig } from "@/lib/config/server";
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
import {
	createLogger,
	recordAiLatency,
	recordChatMessage,
	recordRateLimitHit,
	recordTokenUsage,
	runWithRequestContext,
} from "@/lib/observability";
import type { ChatMessage } from "@/lib/types";
import type { AppUsage } from "@/lib/usage";
import { convertToUIMessages, generateUUID } from "@/lib/utils";
import { generateTitleFromUserMessage } from "../../actions";
import { type PostRequestBody, postRequestBodySchema } from "./schema";

export const maxDuration = 60;

const chatLogger = createLogger("chat");

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
		} catch (error: unknown) {
			if (error instanceof Error && error.message.includes("REDIS_URL")) {
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

export function POST(request: Request) {
	// biome-ignore lint/complexity/noExcessiveCognitiveComplexity: legacy
	return runWithRequestContext({ request, service: "chat" }, async () => {
		let requestBody: PostRequestBody;
		let streamId: string | undefined;
		let aiStartTime: number | undefined;

		try {
			const json = await request.json();
			requestBody = postRequestBodySchema.parse(json);
		} catch (error) {
			chatLogger.error({
				event: "chat.request.parse_failed",
				error: error instanceof Error ? error.message : String(error),
				exception: error,
			});
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

			chatLogger.info({
				event: "chat.request.received",
				chatId: id,
				details: {
					messagePartCount: message.parts.length,
					selectedChatModel,
				},
			});

			const session = await auth();

			chatLogger.info({
				event: "chat.session.checked",
				userId: session?.user?.id,
				details: {
					hasSession: Boolean(session?.user),
					userType: session?.user?.type,
				},
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

			chatLogger.info({
				event: "chat.quota.checked",
				userId: session.user.id,
				chatId: id,
				details: {
					messageCount,
					maxMessagesPerDay,
				},
			});

			if (messageCount >= maxMessagesPerDay) {
				recordRateLimitHit({ service: "chat", userId: session.user.id });
				chatLogger.warn({
					event: "chat.rate_limited",
					userId: session.user.id,
					details: { messageCount },
				});
				return new ChatSDKError("rate_limit:chat").toResponse();
			}

			const chat = await getChatById({ id });
			let messagesFromDb: DBMessage[] = [];

			if (chat) {
				if (chat.userId !== session.user.id) {
					chatLogger.warn({
						event: "chat.access.denied",
						userId: session.user.id,
						chatId: id,
						details: { chatOwnerId: chat.userId },
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

				chatLogger.info({
					event: "chat.created",
					userId: session.user.id,
					chatId: id,
					details: { titleLength: title.length },
				});
			}

			const uiMessages = [...convertToUIMessages(messagesFromDb), message];

			const { longitude, latitude, city, country } = geolocation(request);

			const requestHints: RequestHints = {
				longitude,
				latitude,
				city,
				country,
			};

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

			chatLogger.info({
				event: "chat.message.saved",
				userId: session.user.id,
				chatId: id,
				details: {
					messageId: message.id,
					role: "user",
					priorMessageCount: messagesFromDb.length,
				},
			});

			recordChatMessage({
				model: selectedChatModel,
				userId: session.user.id,
			});

			const newStreamId = generateUUID();
			streamId = newStreamId;
			await createStreamId({ streamId: newStreamId, chatId: id });

			aiStartTime = Date.now();

			let finalMergedUsage: AppUsage | undefined;

			const stream = createUIMessageStream({
				execute: async ({ writer: dataStream }) => {
					const aiConfig = getAiConfig();
					chatLogger.info({
						event: "chat.stream.started",
						userId: session.user.id,
						chatId: id,
						details: {
							uiMessageCount: uiMessages.length,
							selectedChatModel,
							hasOpenAiKey: aiConfig.hasOpenAiKey,
							hasAnthropicKey: aiConfig.hasAnthropicKey,
						},
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
						onFinish: async ({ usage }) => {
							// Record AI latency
							if (aiStartTime) {
								const latencyMs = Date.now() - aiStartTime;
								recordAiLatency(latencyMs, {
									model: selectedChatModel,
									success: true,
								});
							}

							// Record token usage
							if (usage?.totalTokens) {
								recordTokenUsage(usage.totalTokens, {
									model: selectedChatModel,
									type: "total",
								});
							}

							try {
								const providers = await getTokenlensCatalog();
								const modelId =
									myProvider.languageModel(selectedChatModel).modelId;
								if (!modelId) {
									finalMergedUsage = usage;
									dataStream.write({
										type: "data-usage",
										data: finalMergedUsage,
									});
									return;
								}

								if (!providers) {
									finalMergedUsage = usage;
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
									...usage,
									...summary,
									modelId,
								} as AppUsage;
								dataStream.write({
									type: "data-usage",
									data: finalMergedUsage,
								});
							} catch (err) {
								chatLogger.warn({
									event: "chat.tokenlens.failed",
									chatId: id,
									error: err instanceof Error ? err.message : String(err),
								});
								finalMergedUsage = usage;
								dataStream.write({
									type: "data-usage",
									data: finalMergedUsage,
								});
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

					recordChatMessage({
						model: selectedChatModel,
						userId: session.user.id,
					});

					chatLogger.info({
						event: "chat.response.generated",
						userId: session.user.id,
						chatId: id,
						details: {
							assistantMessageCount: messages.length,
							streamId,
						},
					});

					if (finalMergedUsage) {
						try {
							await updateChatLastContextById({
								chatId: id,
								context: finalMergedUsage,
							});
						} catch (err) {
							chatLogger.warn({
								event: "chat.usage.persist_failed",
								chatId: id,
								error: err instanceof Error ? err.message : String(err),
							});
						}
					}
				},
				onError: (streamError) => {
					// Record failed AI call
					if (aiStartTime) {
						const latencyMs = Date.now() - aiStartTime;
						recordAiLatency(latencyMs, {
							model: selectedChatModel,
							success: false,
						});
					}

					chatLogger.error({
						event: "chat.stream.error",
						chatId: id,
						error:
							streamError instanceof Error
								? streamError.message
								: String(streamError),
						exception: streamError,
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
			if (error instanceof ChatSDKError) {
				chatLogger.info({
					event: "chat.error.handled",
					details: { errorCode: error.statusCode },
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
				chatLogger.warn({
					event: "chat.gateway.credit_card_required",
				});
				return new ChatSDKError("bad_request:activate_gateway").toResponse();
			}

			chatLogger.error({
				event: "chat.error.unhandled",
				error: error instanceof Error ? error.message : String(error),
				exception: error,
				details: { streamId },
			});
			return new ChatSDKError("offline:chat").toResponse();
		}
	});
}
