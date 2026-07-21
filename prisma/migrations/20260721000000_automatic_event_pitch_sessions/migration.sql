-- Every native event has an attached pitch session. Preserve existing sessions
-- and create exactly one default session only for events that have none.
INSERT INTO "PitchSession" (
  "id",
  "eventId",
  "chapterId",
  "legacyBackfill",
  "title",
  "description",
  "startTime",
  "meetingUrl",
  "location",
  "audienceCanReorder",
  "votingEndTime",
  "phase",
  "topProjectCount",
  "topPresentingSec",
  "topQuestionsSec",
  "defaultPresentingSec",
  "defaultQuestionsSec",
  "createdById",
  "createdAt",
  "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  event."id",
  event."chapterId",
  false,
  event."title",
  event."description",
  event."startTime",
  event."meetingUrl",
  event."location",
  true,
  event."startTime" + INTERVAL '15 minutes',
  'VOTING'::"PitchSessionPhase",
  5,
  120,
  180,
  60,
  120,
  event."createdById",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Event" event
WHERE NOT EXISTS (
  SELECT 1
  FROM "PitchSession" session
  WHERE session."eventId" = event."id"
);
