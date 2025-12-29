CREATE TABLE "Chat" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"createdAt" timestamp NOT NULL,
	"title" text NOT NULL,
	"userId" uuid NOT NULL,
	"lastContext" jsonb
);
--> statement-breakpoint
CREATE TABLE "Document" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"createdAt" timestamp NOT NULL,
	"title" text NOT NULL,
	"content" text,
	"text" varchar DEFAULT 'text' NOT NULL,
	"userId" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Message" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chatId" uuid NOT NULL,
	"role" varchar(64) NOT NULL,
	"parts" jsonb NOT NULL,
	"attachments" jsonb NOT NULL,
	"metadata" jsonb,
	"createdAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "MessageTemplate" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contentSid" varchar(64) NOT NULL,
	"friendlyName" varchar(256) NOT NULL,
	"language" varchar(10) NOT NULL,
	"variables" jsonb,
	"types" jsonb NOT NULL,
	"whatsappApprovalStatus" varchar(32) DEFAULT 'unsubmitted',
	"whatsappTemplateName" varchar(256),
	"whatsappCategory" varchar(32),
	"rejectionReason" text,
	"twilioCreatedAt" timestamp,
	"twilioUpdatedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastSyncedAt" timestamp DEFAULT now() NOT NULL,
	"isDeleted" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ScheduledMessage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"templateId" uuid,
	"contentSid" varchar(64),
	"contentVariables" jsonb,
	"recipients" jsonb NOT NULL,
	"scheduledAt" timestamp NOT NULL,
	"status" varchar(32) DEFAULT 'pending' NOT NULL,
	"results" jsonb,
	"error" text,
	"processedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"createdBy" varchar(256)
);
--> statement-breakpoint
CREATE TABLE "Stream" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chatId" uuid NOT NULL,
	"createdAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Suggestion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"documentId" uuid NOT NULL,
	"originalText" text NOT NULL,
	"suggestedText" text NOT NULL,
	"description" text,
	"isResolved" boolean DEFAULT false NOT NULL,
	"userId" uuid NOT NULL,
	"createdAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "User" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(64) NOT NULL,
	"phone" varchar(32) NOT NULL,
	"password" varchar(64),
	CONSTRAINT "User_email_unique" UNIQUE("email"),
	CONSTRAINT "User_phone_unique" UNIQUE("phone")
);
--> statement-breakpoint
CREATE TABLE "Vote" (
	"chatId" uuid NOT NULL,
	"messageId" uuid NOT NULL,
	"isUpvoted" boolean NOT NULL,
	CONSTRAINT "Vote_chatId_messageId_pk" PRIMARY KEY("chatId","messageId")
);
--> statement-breakpoint
CREATE TABLE "WebhookLog" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" varchar(64) NOT NULL,
	"direction" varchar(16),
	"status" varchar(64),
	"requestUrl" text,
	"messageSid" varchar(64),
	"fromNumber" varchar(64),
	"toNumber" varchar(64),
	"payload" jsonb,
	"error" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "Chat" ADD CONSTRAINT "Chat_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Document" ADD CONSTRAINT "Document_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Message" ADD CONSTRAINT "Message_chatId_Chat_id_fk" FOREIGN KEY ("chatId") REFERENCES "public"."Chat"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ScheduledMessage" ADD CONSTRAINT "ScheduledMessage_templateId_MessageTemplate_id_fk" FOREIGN KEY ("templateId") REFERENCES "public"."MessageTemplate"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Stream" ADD CONSTRAINT "Stream_chatId_Chat_id_fk" FOREIGN KEY ("chatId") REFERENCES "public"."Chat"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Suggestion" ADD CONSTRAINT "Suggestion_documentId_Document_id_fk" FOREIGN KEY ("documentId") REFERENCES "public"."Document"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Suggestion" ADD CONSTRAINT "Suggestion_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_chatId_Chat_id_fk" FOREIGN KEY ("chatId") REFERENCES "public"."Chat"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "Vote" ADD CONSTRAINT "Vote_messageId_Message_id_fk" FOREIGN KEY ("messageId") REFERENCES "public"."Message"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "Chat_userId_idx" ON "Chat" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "Document_userId_idx" ON "Document" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "Message_chatId_idx" ON "Message" USING btree ("chatId");--> statement-breakpoint
CREATE UNIQUE INDEX "MessageTemplate_contentSid_unique" ON "MessageTemplate" USING btree ("contentSid");--> statement-breakpoint
CREATE INDEX "Stream_chatId_idx" ON "Stream" USING btree ("chatId");--> statement-breakpoint
CREATE INDEX "Suggestion_documentId_idx" ON "Suggestion" USING btree ("documentId");--> statement-breakpoint
CREATE INDEX "Vote_messageId_idx" ON "Vote" USING btree ("messageId");--> statement-breakpoint
CREATE UNIQUE INDEX "WebhookLog_messageSid_unique" ON "WebhookLog" USING btree ("messageSid");