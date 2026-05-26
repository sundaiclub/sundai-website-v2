-- Event management foundations: site-admin cutover, chapters, event staff,
-- application templates, internal registrations, global bans, and organizer notes.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'Role' AND e.enumlabel = 'ADMIN'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'Role' AND e.enumlabel = 'SITE_ADMIN'
  ) THEN
    ALTER TYPE "Role" RENAME VALUE 'ADMIN' TO 'SITE_ADMIN';
  ELSIF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'Role' AND e.enumlabel = 'SITE_ADMIN'
  ) THEN
    ALTER TYPE "Role" ADD VALUE 'SITE_ADMIN';
  END IF;
END $$;

CREATE TYPE "ChapterStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ARCHIVED');
CREATE TYPE "ChapterAccessMode" AS ENUM ('PUBLIC', 'PRIVATE');
CREATE TYPE "ChapterMembershipRole" AS ENUM ('MEMBER', 'ADMIN');
CREATE TYPE "ChapterMembershipStatus" AS ENUM ('INVITED', 'ACTIVE', 'REVOKED', 'LEFT');
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'PAUSED', 'ARCHIVED');
CREATE TYPE "EventVisibility" AS ENUM ('PUBLIC', 'PRIVATE', 'UNLISTED');
CREATE TYPE "EventApplicationMode" AS ENUM ('NONE', 'INTERNAL', 'PUBLIC_LATER');
CREATE TYPE "EventStaffRole" AS ENUM ('MC', 'CO_MC');
CREATE TYPE "ApplicationTemplateScope" AS ENUM ('SITE', 'CHAPTER');
CREATE TYPE "EventRegistrationStatus" AS ENUM ('PENDING', 'APPROVED', 'WAITLISTED', 'DECLINED', 'BLOCKED', 'CANCELLED');
CREATE TYPE "EventRegistrationSource" AS ENUM ('INTERNAL', 'PUBLIC_LATER', 'IMPORT');
CREATE TYPE "BanFlagStatus" AS ENUM ('OPEN', 'REVIEWING', 'RESOLVED_NO_ACTION', 'RESOLVED_BANNED', 'DISMISSED');

CREATE TABLE "Chapter" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "city" TEXT NOT NULL,
  "region" TEXT,
  "country" TEXT NOT NULL,
  "timezone" TEXT NOT NULL,
  "description" TEXT,
  "status" "ChapterStatus" NOT NULL DEFAULT 'ACTIVE',
  "accessMode" "ChapterAccessMode" NOT NULL DEFAULT 'PUBLIC',
  "defaultDeclineMessage" TEXT,
  "mailingListName" TEXT,
  "mailingListExternalId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Chapter_pkey" PRIMARY KEY ("id")
);

INSERT INTO "Chapter" (
  "id", "name", "slug", "city", "region", "country", "timezone",
  "description", "status", "accessMode"
) VALUES (
  'boston', 'Sundai Boston', 'boston', 'Boston', 'MA', 'US',
  'America/New_York', 'Initial Boston chapter backfilled for existing events.',
  'ACTIVE', 'PUBLIC'
);

ALTER TABLE "Event"
  ADD COLUMN "endTime" TIMESTAMP(3),
  ADD COLUMN "venueName" TEXT,
  ADD COLUMN "publicLocation" TEXT,
  ADD COLUMN "address" TEXT,
  ADD COLUMN "virtualUrl" TEXT,
  ADD COLUMN "chapterId" TEXT,
  ADD COLUMN "slug" TEXT,
  ADD COLUMN "slugNeedsCleanup" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN "visibility" "EventVisibility" NOT NULL DEFAULT 'PUBLIC',
  ADD COLUMN "programType" TEXT,
  ADD COLUMN "publicProgramLabel" TEXT,
  ADD COLUMN "capacity" INTEGER,
  ADD COLUMN "applicationMode" "EventApplicationMode" NOT NULL DEFAULT 'NONE',
  ADD COLUMN "autoPromoteWaitlist" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "approvedDetailsJson" JSONB,
  ADD COLUMN "applicationQuestionsJson" JSONB,
  ADD COLUMN "hideChapterDefaultQuestions" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "applicationsOpen" TIMESTAMP(3),
  ADD COLUMN "applicationsCloseReason" TEXT,
  ADD COLUMN "checkInOpensAt" TIMESTAMP(3),
  ADD COLUMN "checkInClosesAt" TIMESTAMP(3);

UPDATE "Event"
SET
  "chapterId" = 'boston',
  "status" = 'PUBLISHED',
  "publicLocation" = "location",
  "virtualUrl" = "meetingUrl";

WITH slug_base AS (
  SELECT
    "id",
    NULLIF(
      trim(both '-' from lower(regexp_replace(coalesce(nullif("title", ''), "id"), '[^a-zA-Z0-9]+', '-', 'g'))),
      ''
    ) AS "baseSlug"
  FROM "Event"
),
numbered AS (
  SELECT
    "id",
    coalesce("baseSlug", 'event') AS "baseSlug",
    count(*) OVER (PARTITION BY coalesce("baseSlug", 'event')) AS "slugCount",
    row_number() OVER (PARTITION BY coalesce("baseSlug", 'event') ORDER BY "id") AS "slugNumber"
  FROM slug_base
)
UPDATE "Event" e
SET
  "slug" = CASE
    WHEN n."slugCount" = 1 THEN n."baseSlug"
    ELSE n."baseSlug" || '-' || substr(e."id", 1, 8)
  END,
  "slugNeedsCleanup" = n."slugCount" > 1
FROM numbered n
WHERE e."id" = n."id";

ALTER TABLE "Event"
  ALTER COLUMN "chapterId" SET NOT NULL,
  ALTER COLUMN "slug" SET NOT NULL;

CREATE TABLE "ChapterMembership" (
  "id" TEXT NOT NULL,
  "chapterId" TEXT NOT NULL,
  "hackerId" TEXT NOT NULL,
  "role" "ChapterMembershipRole" NOT NULL DEFAULT 'MEMBER',
  "status" "ChapterMembershipStatus" NOT NULL DEFAULT 'INVITED',
  "invitedById" TEXT,
  "invitedAt" TIMESTAMP(3),
  "joinedAt" TIMESTAMP(3),
  "leftAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "notificationsAllowed" BOOLEAN NOT NULL DEFAULT false,
  "emailNotificationsEnabled" BOOLEAN NOT NULL DEFAULT false,
  "smsNotificationsEnabled" BOOLEAN NOT NULL DEFAULT false,
  "notificationPreferencesJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChapterMembership_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EventStaff" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "hackerId" TEXT NOT NULL,
  "role" "EventStaffRole" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventStaff_pkey" PRIMARY KEY ("id")
);

INSERT INTO "EventStaff" ("id", "eventId", "hackerId", "role", "createdAt", "updatedAt")
SELECT "id", "eventId", "hackerId", 'MC'::"EventStaffRole", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "EventMC";

CREATE TABLE "ApplicationTemplate" (
  "id" TEXT NOT NULL,
  "scope" "ApplicationTemplateScope" NOT NULL,
  "chapterId" TEXT,
  "name" TEXT NOT NULL,
  "fieldsJson" JSONB NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ApplicationTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EventRegistration" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "hackerId" TEXT NOT NULL,
  "status" "EventRegistrationStatus" NOT NULL DEFAULT 'PENDING',
  "source" "EventRegistrationSource" NOT NULL DEFAULT 'INTERNAL',
  "answersJson" JSONB,
  "templateSnapshotJson" JSONB,
  "publicSafeMessage" TEXT,
  "internalReviewNotes" TEXT,
  "decidedById" TEXT,
  "decidedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventRegistration_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EventRegistrationAudit" (
  "id" TEXT NOT NULL,
  "registrationId" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "fromStatus" "EventRegistrationStatus",
  "toStatus" "EventRegistrationStatus" NOT NULL,
  "changeJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventRegistrationAudit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserBan" (
  "id" TEXT NOT NULL,
  "hackerId" TEXT NOT NULL,
  "publicSafeReason" TEXT NOT NULL,
  "internalNote" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedById" TEXT,
  "revokedAt" TIMESTAMP(3),
  "revocationReason" TEXT,
  CONSTRAINT "UserBan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserBanFlag" (
  "id" TEXT NOT NULL,
  "chapterId" TEXT NOT NULL,
  "hackerId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "status" "BanFlagStatus" NOT NULL DEFAULT 'OPEN',
  "resolutionNote" TEXT,
  "resolvedById" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserBanFlag_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HackerOrganizerNote" (
  "id" TEXT NOT NULL,
  "hackerId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "updatedById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HackerOrganizerNote_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HackerOrganizerNoteRevision" (
  "id" TEXT NOT NULL,
  "noteId" TEXT NOT NULL,
  "hackerId" TEXT NOT NULL,
  "editedById" TEXT NOT NULL,
  "patchText" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HackerOrganizerNoteRevision_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Chapter_slug_key" ON "Chapter"("slug");
CREATE INDEX "Chapter_status_accessMode_idx" ON "Chapter"("status", "accessMode");
CREATE INDEX "Chapter_slug_idx" ON "Chapter"("slug");
CREATE UNIQUE INDEX "ChapterMembership_chapterId_hackerId_key" ON "ChapterMembership"("chapterId", "hackerId");
CREATE INDEX "ChapterMembership_hackerId_status_idx" ON "ChapterMembership"("hackerId", "status");
CREATE INDEX "ChapterMembership_chapterId_role_status_idx" ON "ChapterMembership"("chapterId", "role", "status");
CREATE UNIQUE INDEX "Event_chapterId_slug_key" ON "Event"("chapterId", "slug");
CREATE INDEX "Event_chapterId_status_startTime_idx" ON "Event"("chapterId", "status", "startTime");
CREATE INDEX "Event_visibility_status_idx" ON "Event"("visibility", "status");
CREATE UNIQUE INDEX "EventStaff_eventId_hackerId_role_key" ON "EventStaff"("eventId", "hackerId", "role");
CREATE INDEX "EventStaff_eventId_role_idx" ON "EventStaff"("eventId", "role");
CREATE INDEX "EventStaff_hackerId_idx" ON "EventStaff"("hackerId");
CREATE INDEX "ApplicationTemplate_scope_isActive_idx" ON "ApplicationTemplate"("scope", "isActive");
CREATE INDEX "ApplicationTemplate_chapterId_isActive_idx" ON "ApplicationTemplate"("chapterId", "isActive");
CREATE UNIQUE INDEX "ApplicationTemplate_one_active_site" ON "ApplicationTemplate"("scope") WHERE "scope" = 'SITE' AND "isActive" = true;
CREATE UNIQUE INDEX "ApplicationTemplate_one_active_chapter" ON "ApplicationTemplate"("chapterId") WHERE "scope" = 'CHAPTER' AND "isActive" = true;
CREATE UNIQUE INDEX "EventRegistration_eventId_hackerId_key" ON "EventRegistration"("eventId", "hackerId");
CREATE INDEX "EventRegistration_eventId_status_idx" ON "EventRegistration"("eventId", "status");
CREATE INDEX "EventRegistration_hackerId_status_idx" ON "EventRegistration"("hackerId", "status");
CREATE INDEX "EventRegistrationAudit_registrationId_createdAt_idx" ON "EventRegistrationAudit"("registrationId", "createdAt");
CREATE INDEX "EventRegistrationAudit_eventId_createdAt_idx" ON "EventRegistrationAudit"("eventId", "createdAt");
CREATE INDEX "EventRegistrationAudit_actorId_idx" ON "EventRegistrationAudit"("actorId");
CREATE INDEX "UserBan_hackerId_revokedAt_idx" ON "UserBan"("hackerId", "revokedAt");
CREATE UNIQUE INDEX "UserBan_one_active_per_hacker" ON "UserBan"("hackerId") WHERE "revokedAt" IS NULL;
CREATE INDEX "UserBan_createdById_idx" ON "UserBan"("createdById");
CREATE INDEX "UserBanFlag_chapterId_status_idx" ON "UserBanFlag"("chapterId", "status");
CREATE INDEX "UserBanFlag_hackerId_status_idx" ON "UserBanFlag"("hackerId", "status");
CREATE INDEX "UserBanFlag_createdById_idx" ON "UserBanFlag"("createdById");
CREATE UNIQUE INDEX "HackerOrganizerNote_hackerId_key" ON "HackerOrganizerNote"("hackerId");
CREATE INDEX "HackerOrganizerNote_updatedById_idx" ON "HackerOrganizerNote"("updatedById");
CREATE INDEX "HackerOrganizerNoteRevision_noteId_createdAt_idx" ON "HackerOrganizerNoteRevision"("noteId", "createdAt");
CREATE INDEX "HackerOrganizerNoteRevision_hackerId_createdAt_idx" ON "HackerOrganizerNoteRevision"("hackerId", "createdAt");
CREATE INDEX "HackerOrganizerNoteRevision_editedById_idx" ON "HackerOrganizerNoteRevision"("editedById");

ALTER TABLE "Event" ADD CONSTRAINT "Event_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ChapterMembership" ADD CONSTRAINT "ChapterMembership_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ChapterMembership" ADD CONSTRAINT "ChapterMembership_hackerId_fkey" FOREIGN KEY ("hackerId") REFERENCES "Hacker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ChapterMembership" ADD CONSTRAINT "ChapterMembership_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "Hacker"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EventStaff" ADD CONSTRAINT "EventStaff_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EventStaff" ADD CONSTRAINT "EventStaff_hackerId_fkey" FOREIGN KEY ("hackerId") REFERENCES "Hacker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ApplicationTemplate" ADD CONSTRAINT "ApplicationTemplate_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ApplicationTemplate" ADD CONSTRAINT "ApplicationTemplate_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Hacker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EventRegistration" ADD CONSTRAINT "EventRegistration_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EventRegistration" ADD CONSTRAINT "EventRegistration_hackerId_fkey" FOREIGN KEY ("hackerId") REFERENCES "Hacker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EventRegistration" ADD CONSTRAINT "EventRegistration_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "Hacker"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EventRegistrationAudit" ADD CONSTRAINT "EventRegistrationAudit_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "EventRegistration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EventRegistrationAudit" ADD CONSTRAINT "EventRegistrationAudit_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EventRegistrationAudit" ADD CONSTRAINT "EventRegistrationAudit_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Hacker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UserBan" ADD CONSTRAINT "UserBan_hackerId_fkey" FOREIGN KEY ("hackerId") REFERENCES "Hacker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UserBan" ADD CONSTRAINT "UserBan_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Hacker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UserBan" ADD CONSTRAINT "UserBan_revokedById_fkey" FOREIGN KEY ("revokedById") REFERENCES "Hacker"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "UserBanFlag" ADD CONSTRAINT "UserBanFlag_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UserBanFlag" ADD CONSTRAINT "UserBanFlag_hackerId_fkey" FOREIGN KEY ("hackerId") REFERENCES "Hacker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UserBanFlag" ADD CONSTRAINT "UserBanFlag_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Hacker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "UserBanFlag" ADD CONSTRAINT "UserBanFlag_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "Hacker"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "HackerOrganizerNote" ADD CONSTRAINT "HackerOrganizerNote_hackerId_fkey" FOREIGN KEY ("hackerId") REFERENCES "Hacker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HackerOrganizerNote" ADD CONSTRAINT "HackerOrganizerNote_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "Hacker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HackerOrganizerNoteRevision" ADD CONSTRAINT "HackerOrganizerNoteRevision_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "HackerOrganizerNote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HackerOrganizerNoteRevision" ADD CONSTRAINT "HackerOrganizerNoteRevision_hackerId_fkey" FOREIGN KEY ("hackerId") REFERENCES "Hacker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "HackerOrganizerNoteRevision" ADD CONSTRAINT "HackerOrganizerNoteRevision_editedById_fkey" FOREIGN KEY ("editedById") REFERENCES "Hacker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

DROP TABLE "EventMC";
