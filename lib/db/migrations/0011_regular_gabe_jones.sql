ALTER TABLE "Message" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "Vote" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "Message" CASCADE;--> statement-breakpoint
DROP TABLE "Vote" CASCADE;--> statement-breakpoint
ALTER TABLE "User" ALTER COLUMN "phone" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "User_email_unique" ON "User" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "User_phone_unique" ON "User" USING btree ("phone");--> statement-breakpoint
CREATE UNIQUE INDEX "WebhookLog_messageSid_unique" ON "WebhookLog" USING btree ("messageSid");