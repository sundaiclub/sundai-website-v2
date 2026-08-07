ALTER TABLE "Event" ADD COLUMN "timezone" TEXT;

UPDATE "Event"
SET "timezone" = "Chapter"."timezone"
FROM "Chapter"
WHERE "Event"."chapterId" = "Chapter"."id";

ALTER TABLE "Event" ALTER COLUMN "timezone" SET NOT NULL;
