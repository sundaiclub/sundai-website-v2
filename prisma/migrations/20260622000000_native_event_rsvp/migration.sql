-- Native event RSVP cutover: public application semantics, explicit
-- application open/closed state, and registration lifecycle metadata.

-- Preserve Phase 1 values long enough to derive explicit Phase 2 state.
ALTER TABLE "Event" ADD COLUMN "legacyApplicationMode" TEXT;

UPDATE "Event"
SET "legacyApplicationMode" = "applicationMode"::text;

ALTER TABLE "Event" RENAME COLUMN "applicationsOpen" TO "legacyApplicationsOpenAt";

-- Cut application-mode values over to Phase 2 values.
ALTER TABLE "Event" ALTER COLUMN "applicationMode" DROP DEFAULT;

CREATE TYPE "EventApplicationMode_new" AS ENUM ('REQUIRES_APPROVAL', 'OPEN_RSVP');

ALTER TABLE "Event"
  ALTER COLUMN "applicationMode" TYPE "EventApplicationMode_new"
  USING (
    CASE "legacyApplicationMode"
      WHEN 'OPEN_RSVP' THEN 'OPEN_RSVP'
      ELSE 'REQUIRES_APPROVAL'
    END
  )::"EventApplicationMode_new";

ALTER TYPE "EventApplicationMode" RENAME TO "EventApplicationMode_old";
ALTER TYPE "EventApplicationMode_new" RENAME TO "EventApplicationMode";
DROP TYPE "EventApplicationMode_old";

ALTER TABLE "Event"
  ALTER COLUMN "applicationMode" SET DEFAULT 'REQUIRES_APPROVAL';

-- Cut public registration source to WEBSITE while preserving internal and import registrations.
ALTER TABLE "EventRegistration" ALTER COLUMN "source" DROP DEFAULT;

CREATE TYPE "EventRegistrationSource_new" AS ENUM ('INTERNAL', 'WEBSITE', 'IMPORT');

ALTER TABLE "EventRegistration"
  ALTER COLUMN "source" TYPE "EventRegistrationSource_new"
  USING (
    CASE "source"::text
      WHEN 'PUBLIC_LATER' THEN 'WEBSITE'
      ELSE "source"::text
    END
  )::"EventRegistrationSource_new";

ALTER TYPE "EventRegistrationSource" RENAME TO "EventRegistrationSource_old";
ALTER TYPE "EventRegistrationSource_new" RENAME TO "EventRegistrationSource";
DROP TYPE "EventRegistrationSource_old";

ALTER TABLE "EventRegistration"
  ALTER COLUMN "source" SET DEFAULT 'INTERNAL';

-- Convert ambiguous nullable timestamp-style applicationsOpen into explicit open/closed state.
ALTER TABLE "Event"
  ADD COLUMN "applicationsOpen" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "applicationsClosedAt" TIMESTAMP(3),
  ADD COLUMN "applicationsClosedById" TEXT,
  ADD COLUMN "confirmationMessage" TEXT,
  ADD COLUMN "waitlistMessage" TEXT,
  ADD COLUMN "declineMessage" TEXT;

UPDATE "Event"
SET "applicationsOpen" = (
  "legacyApplicationMode" = 'PUBLIC_LATER'
  OR "legacyApplicationsOpenAt" IS NOT NULL
);

ALTER TABLE "Event"
  DROP COLUMN "legacyApplicationMode",
  DROP COLUMN "legacyApplicationsOpenAt";

ALTER TABLE "Event"
  ADD CONSTRAINT "Event_applicationsClosedById_fkey"
  FOREIGN KEY ("applicationsClosedById")
  REFERENCES "Hacker"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

-- Add registration submission, cancellation, and waitlist-ordering metadata.
ALTER TABLE "EventRegistration"
  ADD COLUMN "submittedAt" TIMESTAMP(3),
  ADD COLUMN "cancelledById" TEXT,
  ADD COLUMN "cancelledAt" TIMESTAMP(3),
  ADD COLUMN "waitlistedAt" TIMESTAMP(3);

UPDATE "EventRegistration"
SET "submittedAt" = "createdAt"
WHERE "submittedAt" IS NULL;

UPDATE "EventRegistration"
SET "waitlistedAt" = COALESCE("decidedAt", "updatedAt", "createdAt")
WHERE "status" = 'WAITLISTED'
  AND "waitlistedAt" IS NULL;

ALTER TABLE "EventRegistration"
  ALTER COLUMN "submittedAt" SET NOT NULL,
  ALTER COLUMN "submittedAt" SET DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "EventRegistration"
  ADD CONSTRAINT "EventRegistration_cancelledById_fkey"
  FOREIGN KEY ("cancelledById")
  REFERENCES "Hacker"("id")
  ON DELETE SET NULL
  ON UPDATE CASCADE;

CREATE INDEX "EventRegistration_eventId_status_cancelledAt_idx"
  ON "EventRegistration"("eventId", "status", "cancelledAt");

CREATE INDEX "EventRegistration_eventId_status_waitlistedAt_idx"
  ON "EventRegistration"("eventId", "status", "waitlistedAt");
