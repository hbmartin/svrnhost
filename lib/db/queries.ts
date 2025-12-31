import "server-only";

import {
	and,
	asc,
	count,
	desc,
	eq,
	gt,
	gte,
	inArray,
	lt,
	type SQL,
} from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getPostgresUrl } from "../config/server";
import { ChatSDKError } from "../errors";
import type { AppUsage } from "../usage";
import {
	type Chat,
	chat,
	type DBMessage,
	document,
	message,
	type Suggestion,
	stream,
	suggestion,
	type User,
	user,
	vote,
	webhookLog,
} from "./schema";
import { generateHashedPassword } from "./utils";

// Optionally, if not using email/pass login, you can
// use the Drizzle adapter for Auth.js / NextAuth
// https://authjs.dev/reference/adapter/drizzle

const client = postgres(getPostgresUrl());
const db = drizzle(client);

export async function getUser(email: string): Promise<User[]> {
	try {
		return await db.select().from(user).where(eq(user.email, email));
	} catch (_error) {
		throw new ChatSDKError(
			"bad_request:database",
			"Failed to get user by email",
		);
	}
}

export async function getUserByPhone(phone: string): Promise<User | null> {
	try {
		const [matchedUser] = await db
			.select()
			.from(user)
			.where(eq(user.phone, phone))
			.limit(1);

		return matchedUser ?? null;
	} catch (_error) {
		throw new ChatSDKError(
			"bad_request:database",
			"Failed to get user by phone",
		);
	}
}

export async function createUser(
	email: string,
	password: string,
	phone: string,
) {
	const hashedPassword = generateHashedPassword(password);

	try {
		return await db
			.insert(user)
			.values({ email, password: hashedPassword, phone })
			.returning();
	} catch (_error) {
		throw new ChatSDKError("bad_request:database", "Failed to create user");
	}
}

export async function saveChat({
	id,
	userId,
	title,
}: {
	id: string;
	userId: string;
	title: string;
}) {
	try {
		return await db.insert(chat).values({
			id,
			createdAt: new Date(),
			userId,
			title,
		});
	} catch (_error) {
		throw new ChatSDKError("bad_request:database", "Failed to save chat");
	}
}

export async function deleteChatById({ id }: { id: string }) {
	try {
		await db.delete(vote).where(eq(vote.chatId, id));
		await db.delete(message).where(eq(message.chatId, id));
		await db.delete(stream).where(eq(stream.chatId, id));

		const [chatsDeleted] = await db
			.delete(chat)
			.where(eq(chat.id, id))
			.returning();
		return chatsDeleted;
	} catch (_error) {
		throw new ChatSDKError(
			"bad_request:database",
			"Failed to delete chat by id",
		);
	}
}

export async function deleteAllChatsByUserId({ userId }: { userId: string }) {
	try {
		const userChats = await db
			.select({ id: chat.id })
			.from(chat)
			.where(eq(chat.userId, userId));

		if (userChats.length === 0) {
			return { deletedCount: 0 };
		}

		const chatIds = userChats.map((c) => c.id);

		await db.delete(vote).where(inArray(vote.chatId, chatIds));
		await db.delete(message).where(inArray(message.chatId, chatIds));
		await db.delete(stream).where(inArray(stream.chatId, chatIds));

		const deletedChats = await db
			.delete(chat)
			.where(eq(chat.userId, userId))
			.returning();

		return { deletedCount: deletedChats.length };
	} catch (_error) {
		throw new ChatSDKError(
			"bad_request:database",
			"Failed to delete all chats by user id",
		);
	}
}

export async function getChatsByUserId({
	id,
	limit,
	startingAfter,
	endingBefore,
}: {
	id: string;
	limit: number;
	startingAfter: string | null;
	endingBefore: string | null;
}) {
	try {
		const extendedLimit = limit + 1;

		const query = (whereCondition?: SQL<unknown>) =>
			db
				.select()
				.from(chat)
				.where(
					whereCondition
						? and(whereCondition, eq(chat.userId, id))
						: eq(chat.userId, id),
				)
				.orderBy(desc(chat.createdAt))
				.limit(extendedLimit);

		let filteredChats: Chat[] = [];

		if (startingAfter) {
			const [selectedChat] = await db
				.select()
				.from(chat)
				.where(eq(chat.id, startingAfter))
				.limit(1);

			if (!selectedChat) {
				throw new ChatSDKError(
					"not_found:database",
					`Chat with id ${startingAfter} not found`,
				);
			}

			filteredChats = await query(gt(chat.createdAt, selectedChat.createdAt));
		} else if (endingBefore) {
			const [selectedChat] = await db
				.select()
				.from(chat)
				.where(eq(chat.id, endingBefore))
				.limit(1);

			if (!selectedChat) {
				throw new ChatSDKError(
					"not_found:database",
					`Chat with id ${endingBefore} not found`,
				);
			}

			filteredChats = await query(lt(chat.createdAt, selectedChat.createdAt));
		} else {
			filteredChats = await query();
		}

		const hasMore = filteredChats.length > limit;

		return {
			chats: hasMore ? filteredChats.slice(0, limit) : filteredChats,
			hasMore,
		};
	} catch (_error) {
		throw new ChatSDKError(
			"bad_request:database",
			"Failed to get chats by user id",
		);
	}
}

export async function getChatById({ id }: { id: string }) {
	try {
		const [selectedChat] = await db.select().from(chat).where(eq(chat.id, id));
		if (!selectedChat) {
			return null;
		}

		return selectedChat;
	} catch (_error) {
		throw new ChatSDKError("bad_request:database", "Failed to get chat by id");
	}
}

export async function saveMessages({ messages }: { messages: DBMessage[] }) {
	try {
		return await db.insert(message).values(messages);
	} catch (_error) {
		throw new ChatSDKError("bad_request:database", "Failed to save messages");
	}
}

export async function getMessagesByChatId({ id }: { id: string }) {
	try {
		return await db
			.select()
			.from(message)
			.where(eq(message.chatId, id))
			.orderBy(asc(message.createdAt));
	} catch (_error) {
		throw new ChatSDKError(
			"bad_request:database",
			"Failed to get messages by chat id",
		);
	}
}

export async function voteMessage({
	chatId,
	messageId,
	type,
}: {
	chatId: string;
	messageId: string;
	type: "up" | "down";
}) {
	try {
		const [existingVote] = await db
			.select()
			.from(vote)
			.where(and(eq(vote.messageId, messageId)));

		if (existingVote) {
			return await db
				.update(vote)
				.set({ isUpvoted: type === "up" })
				.where(and(eq(vote.messageId, messageId), eq(vote.chatId, chatId)));
		}
		return await db.insert(vote).values({
			chatId,
			messageId,
			isUpvoted: type === "up",
		});
	} catch (_error) {
		throw new ChatSDKError("bad_request:database", "Failed to vote message");
	}
}

export async function getVotesByChatId({ id }: { id: string }) {
	try {
		return await db.select().from(vote).where(eq(vote.chatId, id));
	} catch (_error) {
		throw new ChatSDKError(
			"bad_request:database",
			"Failed to get votes by chat id",
		);
	}
}

export async function getDocumentsById({ id }: { id: string }) {
	try {
		const documents = await db
			.select()
			.from(document)
			.where(eq(document.id, id))
			.orderBy(asc(document.createdAt));

		return documents;
	} catch (_error) {
		throw new ChatSDKError(
			"bad_request:database",
			"Failed to get documents by id",
		);
	}
}

export async function getDocumentById({ id }: { id: string }) {
	try {
		const [selectedDocument] = await db
			.select()
			.from(document)
			.where(eq(document.id, id))
			.orderBy(desc(document.createdAt));

		return selectedDocument;
	} catch (_error) {
		throw new ChatSDKError(
			"bad_request:database",
			"Failed to get document by id",
		);
	}
}

export async function saveSuggestions({
	suggestions,
}: {
	suggestions: Suggestion[];
}) {
	try {
		return await db.insert(suggestion).values(suggestions);
	} catch (_error) {
		throw new ChatSDKError(
			"bad_request:database",
			"Failed to save suggestions",
		);
	}
}

export async function getSuggestionsByDocumentId({
	documentId,
}: {
	documentId: string;
}) {
	try {
		return await db
			.select()
			.from(suggestion)
			.where(eq(suggestion.documentId, documentId));
	} catch (_error) {
		throw new ChatSDKError(
			"bad_request:database",
			"Failed to get suggestions by document id",
		);
	}
}

export async function getMessageById({ id }: { id: string }) {
	try {
		return await db.select().from(message).where(eq(message.id, id));
	} catch (_error) {
		throw new ChatSDKError(
			"bad_request:database",
			"Failed to get message by id",
		);
	}
}

export async function deleteMessagesByChatIdAfterTimestamp({
	chatId,
	timestamp,
}: {
	chatId: string;
	timestamp: Date;
}) {
	try {
		const messagesToDelete = await db
			.select({ id: message.id })
			.from(message)
			.where(
				and(eq(message.chatId, chatId), gte(message.createdAt, timestamp)),
			);

		const messageIds = messagesToDelete.map(
			(currentMessage) => currentMessage.id,
		);

		if (messageIds.length > 0) {
			await db
				.delete(vote)
				.where(
					and(eq(vote.chatId, chatId), inArray(vote.messageId, messageIds)),
				);

			return await db
				.delete(message)
				.where(
					and(eq(message.chatId, chatId), inArray(message.id, messageIds)),
				);
		}
		return undefined;
	} catch (_error) {
		throw new ChatSDKError(
			"bad_request:database",
			"Failed to delete messages by chat id after timestamp",
		);
	}
}

export async function updateChatLastContextById({
	chatId,
	context,
}: {
	chatId: string;
	// Store merged server-enriched usage object
	context: AppUsage;
}) {
	try {
		return await db
			.update(chat)
			.set({ lastContext: context })
			.where(eq(chat.id, chatId));
	} catch (error) {
		console.warn("Failed to update lastContext for chat", chatId, error);
		return;
	}
}

export async function getMessageCountByUserId({
	id,
	differenceInHours,
}: {
	id: string;
	differenceInHours: number;
}) {
	try {
		const twentyFourHoursAgo = new Date(
			Date.now() - differenceInHours * 60 * 60 * 1000,
		);

		const [stats] = await db
			.select({ count: count(message.id) })
			.from(message)
			.innerJoin(chat, eq(message.chatId, chat.id))
			.where(
				and(
					eq(chat.userId, id),
					gte(message.createdAt, twentyFourHoursAgo),
					eq(message.role, "user"),
				),
			)
			.execute();

		return stats?.count ?? 0;
	} catch (_error) {
		throw new ChatSDKError(
			"bad_request:database",
			"Failed to get message count by user id",
		);
	}
}

export async function createStreamId({
	streamId,
	chatId,
}: {
	streamId: string;
	chatId: string;
}) {
	try {
		await db
			.insert(stream)
			.values({ id: streamId, chatId, createdAt: new Date() });
	} catch (_error) {
		throw new ChatSDKError(
			"bad_request:database",
			"Failed to create stream id",
		);
	}
}

export async function getStreamIdsByChatId({ chatId }: { chatId: string }) {
	try {
		const streamIds = await db
			.select({ id: stream.id })
			.from(stream)
			.where(eq(stream.chatId, chatId))
			.orderBy(asc(stream.createdAt))
			.execute();

		return streamIds.map(({ id }) => id);
	} catch (_error) {
		throw new ChatSDKError(
			"bad_request:database",
			"Failed to get stream ids by chat id",
		);
	}
}

export async function getWebhookLogByMessageSid({
	messageSid,
}: {
	messageSid: string;
}) {
	try {
		const [existing] = await db
			.select()
			.from(webhookLog)
			.where(eq(webhookLog.messageSid, messageSid))
			.limit(1);

		return existing ?? null;
	} catch (error) {
		console.error("Failed to read webhook log by messageSid", {
			messageSid,
			error,
		});
		return null;
	}
}

export async function createPendingWebhookLog(entry: {
	source: string;
	requestUrl: string;
	messageSid: string;
	fromNumber: string;
	toNumber: string;
	payload: Record<string, unknown>;
}) {
	try {
		const [created] = await db
			.insert(webhookLog)
			.values({
				source: entry.source,
				direction: "inbound",
				status: "pending",
				requestUrl: entry.requestUrl,
				messageSid: entry.messageSid,
				fromNumber: entry.fromNumber,
				toNumber: entry.toNumber,
				payload: entry.payload,
				createdAt: new Date(),
			})
			.onConflictDoNothing({
				target: webhookLog.messageSid,
			})
			.returning({ id: webhookLog.id });

		return created
			? { outcome: "created" as const, id: created.id }
			: { outcome: "duplicate" as const };
	} catch (error) {
		console.error("Failed to create pending webhook log", {
			messageSid: entry.messageSid,
			error,
		});
		return { outcome: "error" as const };
	}
}

export async function upsertWebhookLogByMessageSid(entry: {
	source: string;
	messageSid: string;
	direction?: string | null | undefined;
	status?: string | null | undefined;
	requestUrl?: string | null | undefined;
	fromNumber?: string | null | undefined;
	toNumber?: string | null | undefined;
	payload?: Record<string, unknown> | null | undefined;
	error?: string | null | undefined;
}) {
	const updates: Partial<typeof webhookLog.$inferInsert> = {};

	if (entry.direction !== undefined) {
		updates.direction = entry.direction ?? null;
	}

	if (entry.status !== undefined) {
		updates.status = entry.status ?? null;
	}

	if (entry.requestUrl !== undefined) {
		updates.requestUrl = entry.requestUrl ?? null;
	}

	if (entry.fromNumber !== undefined) {
		updates.fromNumber = entry.fromNumber ?? null;
	}

	if (entry.toNumber !== undefined) {
		updates.toNumber = entry.toNumber ?? null;
	}

	if (entry.payload !== undefined) {
		updates.payload = entry.payload ?? null;
	}

	if (entry.error !== undefined) {
		updates.error = entry.error ?? null;
	}

	if (Object.keys(updates).length === 0) {
		return null;
	}

	try {
		const [log] = await db
			.insert(webhookLog)
			.values({
				source: entry.source,
				direction: entry.direction ?? null,
				status: entry.status ?? null,
				requestUrl: entry.requestUrl ?? null,
				messageSid: entry.messageSid,
				fromNumber: entry.fromNumber ?? null,
				toNumber: entry.toNumber ?? null,
				payload: entry.payload ?? null,
				error: entry.error ?? null,
				createdAt: new Date(),
			})
			.onConflictDoUpdate({
				target: webhookLog.messageSid,
				set: updates,
			})
			.returning();

		return log ?? null;
	} catch (error) {
		console.error("Failed to upsert webhook log by messageSid", {
			entry,
			error,
		});
		return null;
	}
}

export async function getLatestChatForUser({ userId }: { userId: string }) {
	try {
		const [recentChat] = await db
			.select()
			.from(chat)
			.where(eq(chat.userId, userId))
			.orderBy(desc(chat.createdAt))
			.limit(1);

		return recentChat ?? null;
	} catch (_error) {
		throw new ChatSDKError(
			"bad_request:database",
			"Failed to get latest chat for user",
		);
	}
}

export async function saveWebhookLog(entry: {
	source: string;
	direction?: string | null | undefined;
	status?: string | null | undefined;
	requestUrl?: string | null | undefined;
	messageSid?: string | null | undefined;
	fromNumber?: string | null | undefined;
	toNumber?: string | null | undefined;
	payload?: Record<string, unknown> | null | undefined;
	error?: string | null | undefined;
}) {
	try {
		await db.insert(webhookLog).values({
			source: entry.source,
			direction: entry.direction ?? null,
			status: entry.status ?? null,
			requestUrl: entry.requestUrl ?? null,
			messageSid: entry.messageSid ?? null,
			fromNumber: entry.fromNumber ?? null,
			toNumber: entry.toNumber ?? null,
			payload: entry.payload ?? null,
			error: entry.error ?? null,
			createdAt: new Date(),
		});
	} catch (logError) {
		console.error("Failed to persist webhook log", {
			entry,
			error: logError,
		});
	}
}

export async function updateMessageMetadata({
	id,
	metadata,
}: {
	id: string;
	metadata: Record<string, unknown>;
}) {
	try {
		return await db.update(message).set({ metadata }).where(eq(message.id, id));
	} catch (_error) {
		throw new ChatSDKError(
			"bad_request:database",
			"Failed to update message metadata",
		);
	}
}

export async function getFailedOutboundMessages({
	source,
	limit = 100,
}: {
	source: string;
	limit?: number;
}) {
	try {
		const allMessages = await db
			.select()
			.from(message)
			.where(eq(message.role, "assistant"))
			.orderBy(desc(message.createdAt))
			.limit(limit * 10); // Fetch more to filter in JS since JSONB filtering varies by DB

		// Filter messages with failed sendStatus from the specified source
		return allMessages
			.filter((msg) => {
				const meta = msg.metadata as Record<string, unknown> | null;
				return (
					meta?.["source"] === source &&
					meta?.["direction"] === "outbound" &&
					meta?.["sendStatus"] === "failed"
				);
			})
			.slice(0, limit);
	} catch (_error) {
		throw new ChatSDKError(
			"bad_request:database",
			"Failed to get failed outbound messages",
		);
	}
}
