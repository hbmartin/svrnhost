-- Migration: Make phone column required on User table
-- This migration assumes all existing users have a phone number set.
-- If there are users with NULL phone, they must be updated before running this migration.

-- Verify no NULL phone values exist (will fail if any exist)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "User" WHERE phone IS NULL) THEN
    RAISE EXCEPTION 'Cannot make phone NOT NULL: some users have NULL phone values. Please update them first.';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE "User" ALTER COLUMN "phone" SET NOT NULL;
