-- AlterTable
ALTER TABLE "Event"
ADD COLUMN "votingEndTime" TIMESTAMP(3);

-- Backfill: default votingEndTime to 15 minutes after startTime
UPDATE "Event"
SET "votingEndTime" = "startTime" + INTERVAL '15 minutes'
WHERE "votingEndTime" IS NULL;
