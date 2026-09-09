-- Voting starts with the event and ends 15 minutes into its final two hours.
-- Correct sessions that still have the prior auto-generated start + 15 minute value.
UPDATE "PitchSession" AS session
SET "votingEndTime" = event."endTime" - INTERVAL '1 hour 45 minutes'
FROM "Event" AS event
WHERE session."eventId" = event."id"
  AND event."endTime" IS NOT NULL
  AND session."votingEndTime" = session."startTime" + INTERVAL '15 minutes';
