-- Migration: Add unique indexes to email and phone columns on User table
-- This ensures no duplicate emails or phone numbers can be inserted at the database level.

-- Add unique index on email
CREATE UNIQUE INDEX "User_email_unique" ON "User" USING btree ("email");
--> statement-breakpoint
-- Add unique index on phone
CREATE UNIQUE INDEX "User_phone_unique" ON "User" USING btree ("phone");
