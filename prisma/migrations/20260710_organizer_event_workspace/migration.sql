-- Organizer event workspace cutover: private materials, immutable communication
-- snapshots, staff auditing, versioned SMS consent, and project-card state.

CREATE TYPE "EventMaterialKind" AS ENUM ('LINK', 'FILE');
CREATE TYPE "EventMaterialVisibility" AS ENUM ('PUBLIC', 'APPROVED_ATTENDEES', 'ORGANIZERS_ONLY');
CREATE TYPE "EventMaterialAuditAction" AS ENUM ('CREATED', 'UPDATED', 'REORDERED', 'REMOVED');
CREATE TYPE "EventCommunicationChannel" AS ENUM ('EMAIL', 'SMS');
CREATE TYPE "EventCommunicationStatus" AS ENUM ('DRAFT', 'SENDING', 'SENT', 'PARTIAL', 'FAILED');
CREATE TYPE "EventCommunicationAudience" AS ENUM ('ACTIVE_REGISTERED', 'PENDING', 'APPROVED', 'WAITLISTED', 'DECLINED', 'SELECTED');
CREATE TYPE "EventCommunicationRecipientStatus" AS ENUM ('PENDING', 'SENDING', 'SENT', 'FAILED');
CREATE TYPE "EventStaffAuditAction" AS ENUM ('ASSIGNED', 'ROLE_CHANGED', 'REMOVED');
CREATE TYPE "EventProjectCardStatus" AS ENUM ('DRAFT', 'NEEDS_INFO', 'SUBMITTED', 'APPROVED');

ALTER TABLE "ChapterMembership"
  ADD COLUMN "smsConsentAt" TIMESTAMP(3),
  ADD COLUMN "smsConsentVersion" TEXT;

ALTER TABLE "PitchProject"
  ADD COLUMN "cardStatus" "EventProjectCardStatus" NOT NULL DEFAULT 'DRAFT';

-- Collapse historical multiple roles deterministically. MC sorts before CO_MC;
-- ties retain the oldest assignment, then the lexically smallest id.
WITH ranked_staff AS (
  SELECT
    "id",
    ROW_NUMBER() OVER (
      PARTITION BY "eventId", "hackerId"
      ORDER BY
        CASE "role" WHEN 'MC'::"EventStaffRole" THEN 0 ELSE 1 END,
        "createdAt" ASC,
        "id" ASC
    ) AS row_number
  FROM "EventStaff"
)
DELETE FROM "EventStaff"
USING ranked_staff
WHERE "EventStaff"."id" = ranked_staff."id"
  AND ranked_staff.row_number > 1;

DROP INDEX "EventStaff_eventId_hackerId_role_key";
CREATE UNIQUE INDEX "EventStaff_eventId_hackerId_key"
  ON "EventStaff"("eventId", "hackerId");

CREATE TABLE "EventMaterial" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "kind" "EventMaterialKind" NOT NULL,
  "visibility" "EventMaterialVisibility" NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "externalUrl" TEXT,
  "objectKey" TEXT,
  "bucket" TEXT,
  "originalFilename" TEXT,
  "mimeType" TEXT,
  "size" INTEGER,
  "position" INTEGER NOT NULL DEFAULT 0,
  "isAvailable" BOOLEAN NOT NULL DEFAULT true,
  "availableFrom" TIMESTAMP(3),
  "availableUntil" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EventMaterial_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EventMaterialAudit" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "materialId" TEXT,
  "actorId" TEXT NOT NULL,
  "action" "EventMaterialAuditAction" NOT NULL,
  "changeJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventMaterialAudit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EventCommunication" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "sentById" TEXT,
  "channel" "EventCommunicationChannel" NOT NULL,
  "status" "EventCommunicationStatus" NOT NULL DEFAULT 'DRAFT',
  "subject" TEXT,
  "body" TEXT NOT NULL,
  "audienceType" "EventCommunicationAudience" NOT NULL,
  "audienceDefinitionJson" JSONB NOT NULL,
  "previewFingerprint" TEXT,
  "recipientCount" INTEGER NOT NULL DEFAULT 0,
  "sentCount" INTEGER NOT NULL DEFAULT 0,
  "failedCount" INTEGER NOT NULL DEFAULT 0,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EventCommunication_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EventCommunicationRecipient" (
  "id" TEXT NOT NULL,
  "communicationId" TEXT NOT NULL,
  "hackerId" TEXT NOT NULL,
  "registrationId" TEXT NOT NULL,
  "contactValue" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "status" "EventCommunicationRecipientStatus" NOT NULL DEFAULT 'PENDING',
  "providerMessageId" TEXT,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "attemptedAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EventCommunicationRecipient_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EventStaffAudit" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "staffHackerId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "action" "EventStaffAuditAction" NOT NULL,
  "fromRole" "EventStaffRole",
  "toRole" "EventStaffRole",
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventStaffAudit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EventMaterial_objectKey_key" ON "EventMaterial"("objectKey");
CREATE INDEX "EventMaterial_eventId_visibility_isAvailable_position_idx"
  ON "EventMaterial"("eventId", "visibility", "isAvailable", "position");

CREATE INDEX "EventMaterialAudit_eventId_createdAt_idx"
  ON "EventMaterialAudit"("eventId", "createdAt");
CREATE INDEX "EventMaterialAudit_materialId_createdAt_idx"
  ON "EventMaterialAudit"("materialId", "createdAt");
CREATE INDEX "EventMaterialAudit_actorId_createdAt_idx"
  ON "EventMaterialAudit"("actorId", "createdAt");

CREATE INDEX "EventCommunication_eventId_createdAt_idx"
  ON "EventCommunication"("eventId", "createdAt");
CREATE INDEX "EventCommunication_eventId_status_createdAt_idx"
  ON "EventCommunication"("eventId", "status", "createdAt");
CREATE INDEX "EventCommunication_createdById_createdAt_idx"
  ON "EventCommunication"("createdById", "createdAt");

CREATE UNIQUE INDEX "EventCommunicationRecipient_communicationId_hackerId_key"
  ON "EventCommunicationRecipient"("communicationId", "hackerId");
CREATE INDEX "EventCommunicationRecipient_communicationId_status_idx"
  ON "EventCommunicationRecipient"("communicationId", "status");
CREATE INDEX "EventCommunicationRecipient_hackerId_createdAt_idx"
  ON "EventCommunicationRecipient"("hackerId", "createdAt");
CREATE INDEX "EventCommunicationRecipient_registrationId_idx"
  ON "EventCommunicationRecipient"("registrationId");

CREATE INDEX "EventStaffAudit_eventId_createdAt_idx"
  ON "EventStaffAudit"("eventId", "createdAt");
CREATE INDEX "EventStaffAudit_staffHackerId_createdAt_idx"
  ON "EventStaffAudit"("staffHackerId", "createdAt");
CREATE INDEX "EventStaffAudit_actorId_createdAt_idx"
  ON "EventStaffAudit"("actorId", "createdAt");

ALTER TABLE "EventMaterial"
  ADD CONSTRAINT "EventMaterial_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "EventMaterial_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "Hacker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EventMaterialAudit"
  ADD CONSTRAINT "EventMaterialAudit_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "EventMaterialAudit_materialId_fkey"
  FOREIGN KEY ("materialId") REFERENCES "EventMaterial"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "EventMaterialAudit_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "Hacker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EventCommunication"
  ADD CONSTRAINT "EventCommunication_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "EventCommunication_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "Hacker"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "EventCommunication_sentById_fkey"
  FOREIGN KEY ("sentById") REFERENCES "Hacker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EventCommunicationRecipient"
  ADD CONSTRAINT "EventCommunicationRecipient_communicationId_fkey"
  FOREIGN KEY ("communicationId") REFERENCES "EventCommunication"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "EventCommunicationRecipient_hackerId_fkey"
  FOREIGN KEY ("hackerId") REFERENCES "Hacker"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "EventCommunicationRecipient_registrationId_fkey"
  FOREIGN KEY ("registrationId") REFERENCES "EventRegistration"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EventStaffAudit"
  ADD CONSTRAINT "EventStaffAudit_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "EventStaffAudit_staffHackerId_fkey"
  FOREIGN KEY ("staffHackerId") REFERENCES "Hacker"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "EventStaffAudit_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "Hacker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
