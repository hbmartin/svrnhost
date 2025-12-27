CREATE TABLE "QueuedMessage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"content" text NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"scheduledFor" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"createdBy" uuid NOT NULL,
	"sentAt" timestamp,
	"deferCount" integer DEFAULT 0 NOT NULL,
	"lastDeferredAt" timestamp,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "UserEngagement" (
	"userId" uuid PRIMARY KEY NOT NULL,
	"lastInboundMessageAt" timestamp NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "QueuedMessage" ADD CONSTRAINT "QueuedMessage_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "QueuedMessage" ADD CONSTRAINT "QueuedMessage_createdBy_User_id_fk" FOREIGN KEY ("createdBy") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "UserEngagement" ADD CONSTRAINT "UserEngagement_userId_User_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "QueuedMessage_status_scheduledFor_idx" ON "QueuedMessage" USING btree ("status","scheduledFor");--> statement-breakpoint
CREATE INDEX "QueuedMessage_userId_status_idx" ON "QueuedMessage" USING btree ("userId","status");