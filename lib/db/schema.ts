import type { InferSelectModel } from "drizzle-orm";
import {
	boolean,
	foreignKey,
	index,
	jsonb,
	pgTable,
	primaryKey,
	text,
	timestamp,
	uniqueIndex,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";
import type { AppUsage } from "../usage";

export const user = pgTable(
	"User",
	{
		id: uuid("id").primaryKey().notNull().defaultRandom(),
		email: varchar("email", { length: 64 }).notNull().unique(),
		phone: varchar("phone", { length: 32 }).notNull().unique(),
		password: varchar("password", { length: 64 }),
	},
	(table) => ({
		unique_email: uniqueIndex("User_email_unique").on(table.email),
		unique_phone: uniqueIndex("User_phone_unique").on(table.phone),
	}),
);

export type User = InferSelectModel<typeof user>;

export const chat = pgTable(
	"Chat",
	{
		id: uuid("id").primaryKey().notNull().defaultRandom(),
		createdAt: timestamp("createdAt").notNull(),
		title: text("title").notNull(),
		userId: uuid("userId")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		lastContext: jsonb("lastContext").$type<AppUsage | null>(),
	},
	(table) => ({
		userIdIdx: index("Chat_userId_idx").on(table.userId),
	}),
);

export type Chat = InferSelectModel<typeof chat>;

export const message = pgTable(
	"Message",
	{
		id: uuid("id").primaryKey().notNull().defaultRandom(),
		chatId: uuid("chatId")
			.notNull()
			.references(() => chat.id, { onDelete: "cascade" }),
		role: varchar("role", { length: 64 }).notNull(),
		parts: jsonb("parts").notNull(),
		attachments: jsonb("attachments").notNull(),
		metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
		createdAt: timestamp("createdAt").notNull(),
	},
	(table) => ({
		chatIdIdx: index("Message_chatId_idx").on(table.chatId),
	}),
);

export type DBMessage = InferSelectModel<typeof message>;

export const vote = pgTable(
	"Vote",
	{
		chatId: uuid("chatId")
			.notNull()
			.references(() => chat.id, { onDelete: "cascade" }),
		messageId: uuid("messageId")
			.notNull()
			.references(() => message.id, { onDelete: "cascade" }),
		isUpvoted: boolean("isUpvoted").notNull(),
	},
	(table) => ({
		pk: primaryKey({ columns: [table.chatId, table.messageId] }),
		messageIdIdx: index("Vote_messageId_idx").on(table.messageId),
	}),
);

export type Vote = InferSelectModel<typeof vote>;

export const document = pgTable(
	"Document",
	{
		id: uuid("id").notNull().defaultRandom(),
		createdAt: timestamp("createdAt").notNull(),
		title: text("title").notNull(),
		content: text("content"),
		kind: varchar("text", { enum: ["text", "sheet"] })
			.notNull()
			.default("text"),
		userId: uuid("userId")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
	},
	(table) => {
		return {
			pk: primaryKey({ columns: [table.id, table.createdAt] }),
		};
	},
);

export type Document = InferSelectModel<typeof document>;

export const suggestion = pgTable(
	"Suggestion",
	{
		id: uuid("id").notNull().defaultRandom(),
		documentId: uuid("documentId").notNull(),
		documentCreatedAt: timestamp("documentCreatedAt").notNull(),
		originalText: text("originalText").notNull(),
		suggestedText: text("suggestedText").notNull(),
		description: text("description"),
		isResolved: boolean("isResolved").notNull().default(false),
		userId: uuid("userId")
			.notNull()
			.references(() => user.id, { onDelete: "cascade" }),
		createdAt: timestamp("createdAt").notNull(),
	},
	(table) => ({
		pk: primaryKey({ columns: [table.id] }),
		documentRef: foreignKey({
			columns: [table.documentId, table.documentCreatedAt],
			foreignColumns: [document.id, document.createdAt],
		}).onDelete("cascade"),
		documentIdIdx: index("Suggestion_documentId_idx").on(table.documentId),
	}),
);

export type Suggestion = InferSelectModel<typeof suggestion>;

export const stream = pgTable(
	"Stream",
	{
		id: uuid("id").notNull().defaultRandom(),
		chatId: uuid("chatId").notNull(),
		createdAt: timestamp("createdAt").notNull(),
	},
	(table) => ({
		pk: primaryKey({ columns: [table.id] }),
		chatRef: foreignKey({
			columns: [table.chatId],
			foreignColumns: [chat.id],
		}).onDelete("cascade"),
		chatIdIdx: index("Stream_chatId_idx").on(table.chatId),
	}),
);

export type Stream = InferSelectModel<typeof stream>;

export const webhookLog = pgTable(
	"WebhookLog",
	{
		id: uuid("id").notNull().defaultRandom().primaryKey(),
		source: varchar("source", { length: 64 }).notNull(),
		direction: varchar("direction", { length: 16 }),
		status: varchar("status", { length: 64 }),
		requestUrl: text("requestUrl"),
		messageSid: varchar("messageSid", { length: 64 }),
		fromNumber: varchar("fromNumber", { length: 64 }),
		toNumber: varchar("toNumber", { length: 64 }),
		payload: jsonb("payload"),
		error: text("error"),
		createdAt: timestamp("createdAt").notNull().defaultNow(),
	},
	(table) => ({
		messageSidUnique: uniqueIndex("WebhookLog_messageSid_unique").on(
			table.messageSid,
		),
	}),
);

export type WebhookLog = InferSelectModel<typeof webhookLog>;
