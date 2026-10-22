ALTER TABLE "Event"
  ALTER COLUMN "judgingOpen" SET DEFAULT false,
  ADD COLUMN "judgesPerProject" INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN "judgingAssignmentsPublishedAt" TIMESTAMP(3);

ALTER TABLE "Event" ADD CONSTRAINT "Event_judgesPerProject_positive"
  CHECK ("judgesPerProject" > 0);

CREATE TABLE "JudgingAssignment" (
  "judgeId" TEXT NOT NULL,
  "submissionId" TEXT NOT NULL,
  CONSTRAINT "JudgingAssignment_pkey" PRIMARY KEY ("judgeId", "submissionId"),
  CONSTRAINT "JudgingAssignment_judgeId_fkey" FOREIGN KEY ("judgeId")
    REFERENCES "EventJudge"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "JudgingAssignment_submissionId_fkey" FOREIGN KEY ("submissionId")
    REFERENCES "JudgingSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "JudgingAssignment_submissionId_idx" ON "JudgingAssignment"("submissionId");

-- Preserve the existing lists for events where scoring has already started.
-- Events without reviews start with a draft and must explicitly open scoring.
UPDATE "Event" e SET "judgingAssignmentsPublishedAt" = CURRENT_TIMESTAMP
WHERE EXISTS (
  SELECT 1 FROM "JudgingSubmission" s JOIN "JudgingReview" r ON r."submissionId" = s.id
  WHERE s."eventId" = e.id
);

INSERT INTO "JudgingAssignment" ("judgeId", "submissionId")
SELECT j.id, s.id
FROM "EventJudge" j
JOIN "EventJudgeTrack" jt ON jt."judgeId" = j.id
JOIN "JudgingSubmission" s ON s."trackId" = jt."trackId" AND s."eventId" = j."eventId"
JOIN "Event" e ON e.id = s."eventId"
WHERE e."judgingAssignmentsPublishedAt" IS NOT NULL AND j."revokedAt" IS NULL;

INSERT INTO "JudgingAssignment" ("judgeId", "submissionId")
SELECT "judgeId", "submissionId" FROM "JudgingReview"
ON CONFLICT DO NOTHING;

-- Existing scored events had no target. Use their smallest active panel as
-- the event target, while preserving their already-visible project lists.
UPDATE "Event" e SET "judgesPerProject" = GREATEST(1, (
  SELECT MIN(coverage.judges)::INTEGER FROM (
    SELECT COUNT(j.id) AS judges
    FROM "JudgingSubmission" s
    LEFT JOIN "JudgingAssignment" a ON a."submissionId" = s.id
    LEFT JOIN "EventJudge" j ON j.id = a."judgeId" AND j."revokedAt" IS NULL
    WHERE s."eventId" = e.id
    GROUP BY s.id
  ) coverage
)) WHERE e."judgingAssignmentsPublishedAt" IS NOT NULL;

UPDATE "Event" SET "judgingOpen" = false WHERE "judgingAssignmentsPublishedAt" IS NULL;
