import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { reset, seed } from "drizzle-seed";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "@/lib/db/schema";
import type { DBMessage, Suggestion } from "@/lib/db/schema";

// Create PGlite instance and drizzle database
let client: PGlite;
let db: PgliteDatabase<typeof schema>;

// Mock server-only before any imports
vi.mock("server-only", () => ({}));

// Mock the database module to use our PGlite instance
vi.mock("@/lib/db/index", () => ({
	get db() {
		return db;
	},
}));

// Mock the config to avoid environment variable issues
vi.mock("@/lib/config/server", () => ({
	getPostgresUrl: () => "postgres://test:test@localhost:5432/test",
}));

beforeAll(async () => {
	client = new PGlite();
	db = drizzle(client, { schema });
	// Apply migrations from the same SQL files used in production
	await migrate(db, { migrationsFolder: "./lib/db/migrations" });
});

afterAll(async () => {
	await client.close();
});

beforeEach(async () => {
	// Reset all tables before each test
	await reset(db, schema);
});

// Import the actual query functions from production code
const {
	getUser,
	getUserByPhone,
	createUser,
	saveChat,
	getChatById,
	deleteChatById,
	deleteAllChatsByUserId,
	getChatsByUserId,
	saveMessages,
	getMessagesByChatId,
	getMessageById,
	deleteMessagesByChatIdAfterTimestamp,
	voteMessage,
	getVotesByChatId,
	getLatestChatForUser,
	createStreamId,
	getStreamIdsByChatId,
	getMessageCountByUserId,
	getWebhookLogByMessageSid,
	createPendingWebhookLog,
	saveWebhookLog,
	saveSuggestions,
	getSuggestionsByDocumentId,
	getDocumentsById,
	getDocumentById,
} = await import("@/lib/db/queries");

// Helper to create test data
function createTestUser() {
	// Use UUID to guarantee unique phone numbers (take first 10 hex chars, convert to digits)
	const uuid = crypto.randomUUID().replace(/-/g, "").slice(0, 10);
	const phoneDigits = uuid
		.split("")
		.map((c) => c.charCodeAt(0) % 10)
		.join("");
	return {
		email: `test-${crypto.randomUUID()}@example.com`,
		password: "testpassword123",
		phone: `+1${phoneDigits}`,
	};
}

// Tests
describe("User queries", () => {
	it("should create a user", async () => {
		const { email, password, phone } = createTestUser();

		const result = await createUser(email, password, phone);

		expect(result).toHaveLength(1);
		expect(result[0].email).toBe(email);
		expect(result[0].phone).toBe(phone);
		expect(result[0].password).not.toBe(password); // Should be hashed
	});

	it("should get user by email", async () => {
		const { email, password, phone } = createTestUser();
		await createUser(email, password, phone);

		const users = await getUser(email);

		expect(users).toHaveLength(1);
		expect(users[0].email).toBe(email);
	});

	it("should return empty array for non-existent email", async () => {
		const users = await getUser("nonexistent@example.com");

		expect(users).toHaveLength(0);
	});

	it("should get user by phone", async () => {
		const { email, password, phone } = createTestUser();
		await createUser(email, password, phone);

		const user = await getUserByPhone(phone);

		expect(user).not.toBeNull();
		expect(user?.phone).toBe(phone);
	});

	it("should return null for non-existent phone", async () => {
		const user = await getUserByPhone("+10000000000");

		expect(user).toBeNull();
	});
});

describe("Chat queries", () => {
	let testUserId: string;

	beforeEach(async () => {
		const { email, password, phone } = createTestUser();
		const [user] = await createUser(email, password, phone);
		testUserId = user.id;
	});

	it("should save and retrieve a chat", async () => {
		const chatId = crypto.randomUUID();
		await saveChat({ id: chatId, userId: testUserId, title: "Test Chat" });

		const chat = await getChatById({ id: chatId });

		expect(chat).not.toBeNull();
		expect(chat?.id).toBe(chatId);
		expect(chat?.title).toBe("Test Chat");
		expect(chat?.userId).toBe(testUserId);
	});

	it("should return null for non-existent chat", async () => {
		const chat = await getChatById({ id: crypto.randomUUID() });

		expect(chat).toBeNull();
	});

	it("should delete a chat and its related data", async () => {
		const chatId = crypto.randomUUID();
		await saveChat({ id: chatId, userId: testUserId, title: "Chat to Delete" });

		const messageId = crypto.randomUUID();
		await saveMessages({
			messages: [
				{
					id: messageId,
					chatId,
					role: "user",
					parts: [{ type: "text", text: "Hello" }],
					attachments: [],
					createdAt: new Date(),
					metadata: null,
				} as DBMessage,
			],
		});

		const deleted = await deleteChatById({ id: chatId });

		expect(deleted?.id).toBe(chatId);

		const chat = await getChatById({ id: chatId });
		expect(chat).toBeNull();

		const messages = await getMessagesByChatId({ id: chatId });
		expect(messages).toHaveLength(0);
	});

	it("should delete all chats for a user", async () => {
		const chatId1 = crypto.randomUUID();
		const chatId2 = crypto.randomUUID();

		await saveChat({ id: chatId1, userId: testUserId, title: "Chat 1" });
		await saveChat({ id: chatId2, userId: testUserId, title: "Chat 2" });

		const result = await deleteAllChatsByUserId({ userId: testUserId });

		expect(result.deletedCount).toBe(2);

		const chat1 = await getChatById({ id: chatId1 });
		const chat2 = await getChatById({ id: chatId2 });
		expect(chat1).toBeNull();
		expect(chat2).toBeNull();
	});

	it("should return deletedCount 0 when user has no chats", async () => {
		const result = await deleteAllChatsByUserId({ userId: testUserId });

		expect(result.deletedCount).toBe(0);
	});

	it("should get chats by user with pagination", async () => {
		// Create 5 chats with different timestamps
		for (let i = 0; i < 5; i++) {
			const chatId = crypto.randomUUID();
			await db.insert(schema.chat).values({
				id: chatId,
				createdAt: new Date(Date.now() + i * 1000),
				userId: testUserId,
				title: `Chat ${i}`,
			});
		}

		const result = await getChatsByUserId({
			id: testUserId,
			limit: 3,
			startingAfter: null,
			endingBefore: null,
		});

		expect(result.chats).toHaveLength(3);
		expect(result.hasMore).toBe(true);
	});

	it("should get latest chat for user", async () => {
		const chatId1 = crypto.randomUUID();
		const chatId2 = crypto.randomUUID();

		await db.insert(schema.chat).values({
			id: chatId1,
			createdAt: new Date(Date.now() - 1000),
			userId: testUserId,
			title: "Older Chat",
		});

		await db.insert(schema.chat).values({
			id: chatId2,
			createdAt: new Date(),
			userId: testUserId,
			title: "Newer Chat",
		});

		const latestChat = await getLatestChatForUser({ userId: testUserId });

		expect(latestChat).not.toBeNull();
		expect(latestChat?.id).toBe(chatId2);
		expect(latestChat?.title).toBe("Newer Chat");
	});

	it("should return null when user has no chats", async () => {
		const latestChat = await getLatestChatForUser({ userId: testUserId });

		expect(latestChat).toBeNull();
	});
});

describe("Message queries", () => {
	let testUserId: string;
	let testChatId: string;

	beforeEach(async () => {
		const { email, password, phone } = createTestUser();
		const [user] = await createUser(email, password, phone);
		testUserId = user.id;

		testChatId = crypto.randomUUID();
		await saveChat({ id: testChatId, userId: testUserId, title: "Test Chat" });
	});

	it("should save and retrieve messages", async () => {
		const messageId = crypto.randomUUID();
		await saveMessages({
			messages: [
				{
					id: messageId,
					chatId: testChatId,
					role: "user",
					parts: [{ type: "text", text: "Hello" }],
					attachments: [],
					createdAt: new Date(),
					metadata: null,
				} as DBMessage,
			],
		});

		const messages = await getMessagesByChatId({ id: testChatId });

		expect(messages).toHaveLength(1);
		expect(messages[0].id).toBe(messageId);
		expect(messages[0].role).toBe("user");
	});

	it("should get message by id", async () => {
		const messageId = crypto.randomUUID();
		await saveMessages({
			messages: [
				{
					id: messageId,
					chatId: testChatId,
					role: "assistant",
					parts: [{ type: "text", text: "Hi there!" }],
					attachments: [],
					createdAt: new Date(),
					metadata: { source: "test" },
				} as DBMessage,
			],
		});

		const messages = await getMessageById({ id: messageId });

		expect(messages).toHaveLength(1);
		expect(messages[0].id).toBe(messageId);
	});

	it("should delete messages after timestamp", async () => {
		const timestamp = new Date();

		const oldMessageId = crypto.randomUUID();
		const newMessageId = crypto.randomUUID();

		await saveMessages({
			messages: [
				{
					id: oldMessageId,
					chatId: testChatId,
					role: "user",
					parts: [{ type: "text", text: "Old message" }],
					attachments: [],
					createdAt: new Date(timestamp.getTime() - 10000),
					metadata: null,
				} as DBMessage,
				{
					id: newMessageId,
					chatId: testChatId,
					role: "user",
					parts: [{ type: "text", text: "New message" }],
					attachments: [],
					createdAt: timestamp,
					metadata: null,
				} as DBMessage,
			],
		});

		await deleteMessagesByChatIdAfterTimestamp({
			chatId: testChatId,
			timestamp,
		});

		const messages = await getMessagesByChatId({ id: testChatId });

		expect(messages).toHaveLength(1);
		expect(messages[0].id).toBe(oldMessageId);
	});

	it("should count user messages within time window", async () => {
		// Create messages at different times
		const now = new Date();
		const withinWindow = new Date(now.getTime() - 1 * 60 * 60 * 1000); // 1 hour ago
		const outsideWindow = new Date(now.getTime() - 25 * 60 * 60 * 1000); // 25 hours ago

		await saveMessages({
			messages: [
				{
					id: crypto.randomUUID(),
					chatId: testChatId,
					role: "user",
					parts: [{ type: "text", text: "Recent message" }],
					attachments: [],
					createdAt: withinWindow,
					metadata: null,
				} as DBMessage,
				{
					id: crypto.randomUUID(),
					chatId: testChatId,
					role: "user",
					parts: [{ type: "text", text: "Old message" }],
					attachments: [],
					createdAt: outsideWindow,
					metadata: null,
				} as DBMessage,
				{
					id: crypto.randomUUID(),
					chatId: testChatId,
					role: "assistant",
					parts: [{ type: "text", text: "Assistant message" }],
					attachments: [],
					createdAt: withinWindow,
					metadata: null,
				} as DBMessage,
			],
		});

		const count = await getMessageCountByUserId({
			id: testUserId,
			differenceInHours: 24,
		});

		// Only counts user messages within 24 hours
		expect(count).toBe(1);
	});
});

describe("Vote queries", () => {
	let testUserId: string;
	let testChatId: string;
	let testMessageId: string;

	beforeEach(async () => {
		const { email, password, phone } = createTestUser();
		const [user] = await createUser(email, password, phone);
		testUserId = user.id;

		testChatId = crypto.randomUUID();
		await saveChat({ id: testChatId, userId: testUserId, title: "Test Chat" });

		testMessageId = crypto.randomUUID();
		await saveMessages({
			messages: [
				{
					id: testMessageId,
					chatId: testChatId,
					role: "assistant",
					parts: [{ type: "text", text: "Response" }],
					attachments: [],
					createdAt: new Date(),
					metadata: null,
				} as DBMessage,
			],
		});
	});

	it("should create an upvote", async () => {
		await voteMessage({
			chatId: testChatId,
			messageId: testMessageId,
			type: "up",
		});

		const votes = await getVotesByChatId({ id: testChatId });

		expect(votes).toHaveLength(1);
		expect(votes[0].isUpvoted).toBe(true);
	});

	it("should create a downvote", async () => {
		await voteMessage({
			chatId: testChatId,
			messageId: testMessageId,
			type: "down",
		});

		const votes = await getVotesByChatId({ id: testChatId });

		expect(votes).toHaveLength(1);
		expect(votes[0].isUpvoted).toBe(false);
	});

	it("should update existing vote", async () => {
		await voteMessage({
			chatId: testChatId,
			messageId: testMessageId,
			type: "up",
		});

		await voteMessage({
			chatId: testChatId,
			messageId: testMessageId,
			type: "down",
		});

		const votes = await getVotesByChatId({ id: testChatId });

		expect(votes).toHaveLength(1);
		expect(votes[0].isUpvoted).toBe(false);
	});
});

describe("Stream queries", () => {
	let testUserId: string;
	let testChatId: string;

	beforeEach(async () => {
		const { email, password, phone } = createTestUser();
		const [user] = await createUser(email, password, phone);
		testUserId = user.id;

		testChatId = crypto.randomUUID();
		await saveChat({ id: testChatId, userId: testUserId, title: "Test Chat" });
	});

	it("should create and retrieve stream ids", async () => {
		const streamId1 = crypto.randomUUID();
		const streamId2 = crypto.randomUUID();

		await createStreamId({ streamId: streamId1, chatId: testChatId });
		await createStreamId({ streamId: streamId2, chatId: testChatId });

		const streamIds = await getStreamIdsByChatId({ chatId: testChatId });

		expect(streamIds).toHaveLength(2);
		expect(streamIds).toContain(streamId1);
		expect(streamIds).toContain(streamId2);
	});
});

describe("Webhook log queries", () => {
	it("should create pending webhook log", async () => {
		const messageSid = `SM${crypto.randomUUID().replace(/-/g, "")}`;

		const result = await createPendingWebhookLog({
			source: "twilio",
			requestUrl: "https://example.com/webhook",
			messageSid,
			fromNumber: "+1234567890",
			toNumber: "+0987654321",
			payload: { test: "data" },
		});

		expect(result.outcome).toBe("created");
		expect(result.id).toBeDefined();
	});

	it("should return duplicate for same messageSid", async () => {
		const messageSid = `SM${crypto.randomUUID().replace(/-/g, "")}`;

		await createPendingWebhookLog({
			source: "twilio",
			requestUrl: "https://example.com/webhook",
			messageSid,
			fromNumber: "+1234567890",
			toNumber: "+0987654321",
			payload: { test: "data" },
		});

		const result = await createPendingWebhookLog({
			source: "twilio",
			requestUrl: "https://example.com/webhook",
			messageSid,
			fromNumber: "+1234567890",
			toNumber: "+0987654321",
			payload: { test: "data2" },
		});

		expect(result.outcome).toBe("duplicate");
	});

	it("should get webhook log by messageSid", async () => {
		const messageSid = `SM${crypto.randomUUID().replace(/-/g, "")}`;

		await createPendingWebhookLog({
			source: "twilio",
			requestUrl: "https://example.com/webhook",
			messageSid,
			fromNumber: "+1234567890",
			toNumber: "+0987654321",
			payload: { test: "data" },
		});

		const log = await getWebhookLogByMessageSid({ messageSid });

		expect(log).not.toBeNull();
		expect(log?.messageSid).toBe(messageSid);
		expect(log?.source).toBe("twilio");
	});

	it("should return null for non-existent messageSid", async () => {
		const log = await getWebhookLogByMessageSid({
			messageSid: "SMnonexistent",
		});

		expect(log).toBeNull();
	});

	it("should save webhook log", async () => {
		const messageSid = `SM${crypto.randomUUID().replace(/-/g, "")}`;

		await saveWebhookLog({
			source: "twilio",
			direction: "outbound",
			status: "sent",
			requestUrl: "https://example.com/webhook",
			messageSid,
			fromNumber: "+1234567890",
			toNumber: "+0987654321",
			payload: { test: "data" },
		});

		// Verify by querying for the specific messageSid
		const log = await getWebhookLogByMessageSid({ messageSid });

		expect(log).not.toBeNull();
		expect(log?.source).toBe("twilio");
		expect(log?.direction).toBe("outbound");
		expect(log?.status).toBe("sent");
		expect(log?.requestUrl).toBe("https://example.com/webhook");
		expect(log?.fromNumber).toBe("+1234567890");
		expect(log?.toNumber).toBe("+0987654321");
	});
});

describe("Document queries", () => {
	let testUserId: string;

	beforeEach(async () => {
		const { email, password, phone } = createTestUser();
		const [user] = await createUser(email, password, phone);
		testUserId = user.id;
	});

	it("should get documents by id", async () => {
		const documentId = crypto.randomUUID();

		await db.insert(schema.document).values({
			id: documentId,
			createdAt: new Date(),
			title: "Test Document",
			content: "Test content",
			kind: "text",
			userId: testUserId,
		});

		const documents = await getDocumentsById({ id: documentId });

		expect(documents).toHaveLength(1);
		expect(documents[0].id).toBe(documentId);
		expect(documents[0].title).toBe("Test Document");
	});

	it("should get latest document by id", async () => {
		const documentId = crypto.randomUUID();

		await db.insert(schema.document).values({
			id: documentId,
			createdAt: new Date(Date.now() - 1000),
			title: "Old Document",
			content: "Old content",
			kind: "text",
			userId: testUserId,
		});

		const latestDoc = await getDocumentById({ id: documentId });

		expect(latestDoc).not.toBeUndefined();
		expect(latestDoc?.title).toBe("Old Document");
	});
});

describe("Suggestion queries", () => {
	let testUserId: string;
	let testDocumentId: string;

	beforeEach(async () => {
		const { email, password, phone } = createTestUser();
		const [user] = await createUser(email, password, phone);
		testUserId = user.id;

		testDocumentId = crypto.randomUUID();
		await db.insert(schema.document).values({
			id: testDocumentId,
			createdAt: new Date(),
			title: "Test Document",
			content: "Test content",
			kind: "text",
			userId: testUserId,
		});
	});

	it("should save and retrieve suggestions", async () => {
		const suggestionId = crypto.randomUUID();

		await saveSuggestions({
			suggestions: [
				{
					id: suggestionId,
					documentId: testDocumentId,
					originalText: "original",
					suggestedText: "suggested",
					description: "Test suggestion",
					isResolved: false,
					userId: testUserId,
					createdAt: new Date(),
				} as Suggestion,
			],
		});

		const suggestions = await getSuggestionsByDocumentId({
			documentId: testDocumentId,
		});

		expect(suggestions).toHaveLength(1);
		expect(suggestions[0].id).toBe(suggestionId);
		expect(suggestions[0].originalText).toBe("original");
		expect(suggestions[0].suggestedText).toBe("suggested");
	});
});

describe("Seeded data tests", () => {
	it("should work with drizzle-seed for bulk data", async () => {
		// Use drizzle-seed to create test data
		await seed(db, { user: schema.user }, { count: 5, seed: 12345 });

		const users = await db.select().from(schema.user);

		expect(users.length).toBe(5);
	});

	it("should create deterministic data with same seed", async () => {
		await seed(db, { user: schema.user }, { count: 3, seed: 99999 });

		const users1 = await db.select().from(schema.user);

		await reset(db, schema);

		await seed(db, { user: schema.user }, { count: 3, seed: 99999 });

		const users2 = await db.select().from(schema.user);

		// Same seed should produce same emails
		expect(users1.map((u) => u.email)).toEqual(users2.map((u) => u.email));
	});
});
