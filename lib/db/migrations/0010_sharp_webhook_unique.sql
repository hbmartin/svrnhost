DELETE FROM "WebhookLog" a
USING "WebhookLog" b
WHERE a."messageSid" = b."messageSid"
AND a."messageSid" IS NOT NULL
AND a.ctid < b.ctid;
--> statement-breakpoint
CREATE UNIQUE INDEX "WebhookLog_messageSid_unique" ON "WebhookLog" ("messageSid");
