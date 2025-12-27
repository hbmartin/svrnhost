import type { InferSelectModel } from "drizzle-orm";
import {
	boolean,
	foreignKey,
	index,
	integer,
	json,
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
		email: varchar("email", { length: 64 }).notNull(),
		phone: varchar("phone", { length: 32 }).notNull(),
		password: varchar("password", { length: 64 }),
	},
	(table) => ({
		unique_email: uniqueIndex("User_email_unique").on(table.email),
		unique_phone: uniqueIndex("User_phone_unique").on(table.phone),
	}),
);

export type User = InferSelectModel<typeof user>;

export const chat = pgTable("Chat", {
	id: uuid("id").primaryKey().notNull().defaultRandom(),
	createdAt: timestamp("createdAt").notNull(),
	title: text("title").notNull(),
	userId: uuid("userId")
		.notNull()
		.references(() => user.id),
	visibility: varchar("visibility", { enum: ["public", "private"] })
		.notNull()
		.default("private"),
	lastContext: jsonb("lastContext").$type<AppUsage | null>(),
});

export type Chat = InferSelectModel<typeof chat>;

export const message = pgTable("Message_v2", {
	id: uuid("id").primaryKey().notNull().defaultRandom(),
	chatId: uuid("chatId")
		.notNull()
		.references(() => chat.id),
	role: varchar("role").notNull(),
	parts: json("parts").notNull(),
	attachments: json("attachments").notNull(),
	metadata: jsonb("metadata").$type<Record<string, unknown> | null>(),
	createdAt: timestamp("createdAt").notNull(),
});

export type DBMessage = InferSelectModel<typeof message>;

export const vote = pgTable(
	"Vote_v2",
	{
		chatId: uuid("chatId")
			.notNull()
			.references(() => chat.id),
		messageId: uuid("messageId")
			.notNull()
			.references(() => message.id),
		isUpvoted: boolean("isUpvoted").notNull(),
	},
	(table) => {
		return {
			pk: primaryKey({ columns: [table.chatId, table.messageId] }),
		};
	},
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
			.references(() => user.id),
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
			.references(() => user.id),
		createdAt: timestamp("createdAt").notNull(),
	},
	(table) => ({
		pk: primaryKey({ columns: [table.id] }),
		documentRef: foreignKey({
			columns: [table.documentId, table.documentCreatedAt],
			foreignColumns: [document.id, document.createdAt],
		}),
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
		}),
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

export const queuedMessage = pgTable(
	"QueuedMessage",
	{
		id: uuid("id").primaryKey().notNull().defaultRandom(),
		userId: uuid("userId")
			.notNull()
			.references(() => user.id),
		content: text("content").notNull(),
		status: varchar("status", {
			enum: ["pending", "sent", "deferred", "failed", "cancelled"],
		})
			.notNull()
			.default("pending"),
		scheduledFor: timestamp("scheduledFor").notNull(),
		createdAt: timestamp("createdAt").notNull().defaultNow(),
		createdBy: uuid("createdBy")
			.notNull()
			.references(() => user.id),
		sentAt: timestamp("sentAt"),
		deferCount: integer("deferCount").notNull().default(0),
		lastDeferredAt: timestamp("lastDeferredAt"),
		error: text("error"),
	},
	(table) => ({
		statusScheduledForIdx: index("QueuedMessage_status_scheduledFor_idx").on(
			table.status,
			table.scheduledFor,
		),
		userIdStatusIdx: index("QueuedMessage_userId_status_idx").on(
			table.userId,
			table.status,
		),
	}),
);

export type QueuedMessage = InferSelectModel<typeof queuedMessage>;

export const userEngagement = pgTable("UserEngagement", {
	userId: uuid("userId")
		.primaryKey()
		.notNull()
		.references(() => user.id),
	lastInboundMessageAt: timestamp("lastInboundMessageAt").notNull(),
	updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export type UserEngagement = InferSelectModel<typeof userEngagement>;
