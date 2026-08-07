-- The foundation migration used true while it backfilled pre-native pitch
-- sessions. New pitch sessions are native and Prisma declares false.
-- Changing only the database default preserves every historical row.
ALTER TABLE "PitchSession"
  ALTER COLUMN "legacyBackfill" SET DEFAULT false;
