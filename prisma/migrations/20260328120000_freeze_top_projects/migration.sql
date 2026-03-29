-- AlterTable
ALTER TABLE "EventProject"
ADD COLUMN "isTopProject" BOOLEAN NOT NULL DEFAULT false;

-- Backfill existing top projects from the long-form pitch timings.
UPDATE "EventProject"
SET "isTopProject" = true
WHERE "allottedPresentingSec" = 120
  AND "allottedQuestionsSec" = 180;
