-- MessageTemplate table for WhatsApp templates synced from Twilio Content API
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
CREATE UNIQUE INDEX "MessageTemplate_contentSid_unique" ON "MessageTemplate" ("contentSid");
--> statement-breakpoint
-- ScheduledMessage table for queuing template sends
CREATE TABLE "ScheduledMessage" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "templateId" uuid REFERENCES "MessageTemplate"("id"),
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
CREATE INDEX "ScheduledMessage_pending_idx" ON "ScheduledMessage" ("scheduledAt") WHERE status = 'pending';
