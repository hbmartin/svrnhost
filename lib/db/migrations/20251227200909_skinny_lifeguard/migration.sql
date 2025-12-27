CREATE TABLE "Chat" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"createdAt" timestamp NOT NULL,
	"title" text NOT NULL,
	"userId" uuid NOT NULL,
	"visibility" varchar DEFAULT 'private' NOT NULL,
	"lastContext" jsonb
);
--> statement-breakpoint
CREATE TABLE "Document" (
	"id" uuid DEFAULT gen_random_uuid(),
	"createdAt" timestamp,
	"title" text NOT NULL,
	"content" text,
	"text" varchar DEFAULT 'text' NOT NULL,
	"userId" uuid NOT NULL,
	CONSTRAINT "Document_pkey" PRIMARY KEY("id","createdAt")
);
--> statement-breakpoint
CREATE TABLE "Message_v2" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"chatId" uuid NOT NULL,
	"role" varchar NOT NULL,
	"parts" json NOT NULL,
	"attachments" json NOT NULL,
	"metadata" jsonb,
	"createdAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Stream" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"chatId" uuid NOT NULL,
	"createdAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "Suggestion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"documentId" uuid NOT NULL,
	"documentCreatedAt" timestamp NOT NULL,
	"originalText" text NOT NULL,
	"suggestedText" text NOT NULL,
	"description" text,
	"isResolved" boolean DEFAULT false NOT NULL,
	"userId" uuid NOT NULL,
	"createdAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "User" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"email" varchar(64) NOT NULL,
	"phone" varchar(32) NOT NULL,
	"password" varchar(64)
);
--> statement-breakpoint
CREATE TABLE "Vote_v2" (
	"chatId" uuid,
	"messageId" uuid,
	"isUpvoted" boolean NOT NULL,
	CONSTRAINT "Vote_v2_pkey" PRIMARY KEY("chatId","messageId")
);
--> statement-breakpoint
CREATE TABLE "WebhookLog" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
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
CREATE UNIQUE INDEX "User_email_unique" ON "User" ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "User_phone_unique" ON "User" ("phone");--> statement-breakpoint
CREATE UNIQUE INDEX "WebhookLog_messageSid_unique" ON "WebhookLog" ("messageSid");--> statement-breakpoint
ALTER TABLE "Chat" ADD CONSTRAINT "Chat_userId_User_id_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id");--> statement-breakpoint
ALTER TABLE "Document" ADD CONSTRAINT "Document_userId_User_id_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id");--> statement-breakpoint
ALTER TABLE "Message_v2" ADD CONSTRAINT "Message_v2_chatId_Chat_id_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat"("id");--> statement-breakpoint
ALTER TABLE "Stream" ADD CONSTRAINT "Stream_chatId_Chat_id_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat"("id");--> statement-breakpoint
ALTER TABLE "Suggestion" ADD CONSTRAINT "Suggestion_userId_User_id_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id");--> statement-breakpoint
ALTER TABLE "Suggestion" ADD CONSTRAINT "Suggestion_0xmkr3D4oqj8_fkey" FOREIGN KEY ("documentId","documentCreatedAt") REFERENCES "Document"("id","createdAt");--> statement-breakpoint
ALTER TABLE "Vote_v2" ADD CONSTRAINT "Vote_v2_chatId_Chat_id_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat"("id");--> statement-breakpoint
ALTER TABLE "Vote_v2" ADD CONSTRAINT "Vote_v2_messageId_Message_v2_id_fkey" FOREIGN KEY ("messageId") REFERENCES "Message_v2"("id");