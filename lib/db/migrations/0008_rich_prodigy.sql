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
ALTER TABLE "Message_v2" ADD COLUMN "metadata" jsonb;