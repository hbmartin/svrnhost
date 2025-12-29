import type { InferSelectModel } from "drizzle-orm";
import {
	boolean,
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

export const user = pgTable("User", {
	id: uuid("id").primaryKey().notNull().defaultRandom(),
	email: varchar("email", { length: 64 }).notNull().unique(),
	phone: varchar("phone", { length: 32 }).notNull().unique(),
	password: varchar("password", { length: 64 }),
});

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
		id: uuid("id").primaryKey().notNull().defaultRandom(),
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
	(table) => ({
		userIdIdx: index("Document_userId_idx").on(table.userId),
	}),
);

export type Document = InferSelectModel<typeof document>;

export const suggestion = pgTable(
	"Suggestion",
	{
		id: uuid("id").primaryKey().notNull().defaultRandom(),
		documentId: uuid("documentId")
			.notNull()
			.references(() => document.id, { onDelete: "cascade" }),
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
		documentIdIdx: index("Suggestion_documentId_idx").on(table.documentId),
	}),
);

export type Suggestion = InferSelectModel<typeof suggestion>;

export const stream = pgTable(
	"Stream",
	{
		id: uuid("id").primaryKey().notNull().defaultRandom(),
		chatId: uuid("chatId")
			.notNull()
			.references(() => chat.id, { onDelete: "cascade" }),
		createdAt: timestamp("createdAt").notNull(),
	},
	(table) => ({
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

// WhatsApp Message Templates synced from Twilio Content API
export const messageTemplate = pgTable(
	"MessageTemplate",
	{
		id: uuid("id").primaryKey().notNull().defaultRandom(),
		// Twilio Content SID (HXxxxxxxxx format)
		contentSid: varchar("contentSid", { length: 64 }).notNull(),
		// Human-readable name
		friendlyName: varchar("friendlyName", { length: 256 }).notNull(),
		// ISO 639-1 language code (e.g., "en")
		language: varchar("language", { length: 10 }).notNull(),
		// Template variables definition (e.g., {"1": "customer_name"})
		variables: jsonb("variables").$type<Record<string, string> | null>(),
		// Content types (twilio/text, twilio/quick-reply, etc.)
		types: jsonb("types").$type<Record<string, unknown>>().notNull(),
		// WhatsApp approval status
		whatsappApprovalStatus: varchar("whatsappApprovalStatus", {
			length: 32,
		}).default("unsubmitted"),
		// WhatsApp template name (required for approval)
		whatsappTemplateName: varchar("whatsappTemplateName", { length: 256 }),
		// WhatsApp category (UTILITY, MARKETING, AUTHENTICATION)
		whatsappCategory: varchar("whatsappCategory", { length: 32 }),
		// Rejection reason from WhatsApp (if rejected)
		rejectionReason: text("rejectionReason"),
		// Timestamps from Twilio
		twilioCreatedAt: timestamp("twilioCreatedAt"),
		twilioUpdatedAt: timestamp("twilioUpdatedAt"),
		// Local timestamps
		createdAt: timestamp("createdAt").notNull().defaultNow(),
		updatedAt: timestamp("updatedAt").notNull().defaultNow(),
		lastSyncedAt: timestamp("lastSyncedAt").notNull().defaultNow(),
		// Soft delete flag
		isDeleted: boolean("isDeleted").notNull().default(false),
	},
	(table) => ({
		contentSidUnique: uniqueIndex("MessageTemplate_contentSid_unique").on(
			table.contentSid,
		),
	}),
);

export type MessageTemplate = InferSelectModel<typeof messageTemplate>;

// Scheduled Messages - queue for future template sends
export const scheduledMessage = pgTable("ScheduledMessage", {
	id: uuid("id").primaryKey().notNull().defaultRandom(),
	// Reference to template (optional - can use contentSid directly)
	templateId: uuid("templateId").references(() => messageTemplate.id),
	// Direct content SID (for templates not in local DB)
	contentSid: varchar("contentSid", { length: 64 }),
	// Variable values for this send
	contentVariables: jsonb("contentVariables").$type<Record<
		string,
		string
	> | null>(),
	// Recipient phone numbers (E.164 format)
	recipients: jsonb("recipients").$type<string[]>().notNull(),
	// When to send
	scheduledAt: timestamp("scheduledAt").notNull(),
	// Execution status
	status: varchar("status", { length: 32 }).notNull().default("pending"),
	// Results after sending
	results: jsonb("results").$type<{
		sent: { phone: string; messageSid: string }[];
		failed: { phone: string; error: string }[];
	} | null>(),
	// Error if failed
	error: text("error"),
	// Processing timestamps
	processedAt: timestamp("processedAt"),
	createdAt: timestamp("createdAt").notNull().defaultNow(),
	// Who scheduled this
	createdBy: varchar("createdBy", { length: 256 }),
});

export type ScheduledMessage = InferSelectModel<typeof scheduledMessage>;
