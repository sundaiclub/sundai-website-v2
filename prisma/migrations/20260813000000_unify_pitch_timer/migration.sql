-- Preserve the full existing pitch slot before removing the presentation/Q&A split.
ALTER TABLE "PitchSession"
RENAME COLUMN "topPresentingSec" TO "topPitchSec";

ALTER TABLE "PitchSession"
RENAME COLUMN "defaultPresentingSec" TO "defaultPitchSec";

UPDATE "PitchSession"
SET
  "topPitchSec" = "topPitchSec" + "topQuestionsSec",
  "defaultPitchSec" = "defaultPitchSec" + "defaultQuestionsSec";

ALTER TABLE "PitchSession"
DROP COLUMN "topQuestionsSec",
DROP COLUMN "defaultQuestionsSec";

ALTER TABLE "PitchProject"
RENAME COLUMN "pitchPhase" TO "timerPhase";

ALTER TABLE "PitchProject"
RENAME COLUMN "presentingStartedAt" TO "timerStartedAt";

ALTER TABLE "PitchProject"
RENAME COLUMN "allottedPresentingSec" TO "allottedSec";

UPDATE "PitchProject"
SET "allottedSec" = COALESCE("allottedSec", 0) + COALESCE("allottedQuestionsSec", 0)
WHERE "allottedSec" IS NOT NULL OR "allottedQuestionsSec" IS NOT NULL;

ALTER TABLE "PitchProject"
DROP COLUMN "questionsStartedAt",
DROP COLUMN "allottedQuestionsSec",
DROP COLUMN "pausedAt";

CREATE TYPE "PitchTimerPhase" AS ENUM ('WAITING', 'RUNNING', 'COMPLETED');

ALTER TABLE "PitchProject"
ALTER COLUMN "timerPhase" DROP DEFAULT,
ALTER COLUMN "timerPhase" TYPE "PitchTimerPhase"
USING (
  CASE
    WHEN "timerPhase"::text IN ('PRESENTING', 'QUESTIONS') THEN 'RUNNING'
    ELSE "timerPhase"::text
  END
)::"PitchTimerPhase",
ALTER COLUMN "timerPhase" SET DEFAULT 'WAITING';

DROP TYPE "PitchPhase";
