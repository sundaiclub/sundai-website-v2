-- AlterTable
ALTER TABLE "WeeklyEmail" ADD COLUMN     "sentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "EventCommunication" ADD COLUMN "sendGroupId" TEXT;

-- Each existing message starts in its own group.
UPDATE "EventCommunication" SET "sendGroupId" = "id";

-- The organizer page created the email and SMS drafts of one send together.
-- Pair each SMS with the email draft from the same organizer, audience, and minute.
UPDATE "EventCommunication" AS sms
SET "sendGroupId" = paired."emailId"
FROM (
  SELECT DISTINCT ON (s."id") s."id" AS "smsId", e."id" AS "emailId"
  FROM "EventCommunication" s
  JOIN "EventCommunication" e
    ON e."eventId" = s."eventId"
   AND e."createdById" = s."createdById"
   AND e."audienceType" = s."audienceType"
   AND e."audienceDefinitionJson"::jsonb = s."audienceDefinitionJson"::jsonb
   AND e."channel" = 'EMAIL'
   AND ABS(EXTRACT(EPOCH FROM (e."createdAt" - s."createdAt"))) <= 60
  WHERE s."channel" = 'SMS'
  ORDER BY s."id", ABS(EXTRACT(EPOCH FROM (e."createdAt" - s."createdAt")))
) AS paired
WHERE sms."id" = paired."smsId";

ALTER TABLE "EventCommunication" ALTER COLUMN "sendGroupId" SET NOT NULL;

-- Earlier weekly sends have no send time; use their last update.
UPDATE "WeeklyEmail" SET "sentAt" = "updatedAt" WHERE "status" <> 'DRAFT';

-- CreateEnum
CREATE TYPE "MessageLinkKind" AS ENUM ('CONTENT', 'PREFERENCES');


-- AlterTable
ALTER TABLE "EventCommunicationRecipient" ADD COLUMN     "complainedAt" TIMESTAMP(3),
ADD COLUMN     "unsubscribedAt" TIMESTAMP(3);


-- CreateTable
CREATE TABLE "WeeklyEmailRecipient" (
    "id" TEXT NOT NULL,
    "weeklyEmailId" TEXT NOT NULL,
    "hackerId" TEXT NOT NULL,
    "contactValue" TEXT NOT NULL,
    "status" "EventCommunicationRecipientStatus" NOT NULL DEFAULT 'PENDING',
    "providerMessageId" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "attemptedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "complainedAt" TIMESTAMP(3),
    "unsubscribedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WeeklyEmailRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageLink" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "kind" "MessageLinkKind" NOT NULL DEFAULT 'CONTENT',
    "eventId" TEXT,
    "eventCommunicationId" TEXT,
    "weeklyEmailId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageShortLink" (
    "code" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "eventRecipientId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageShortLink_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "MessageLinkClick" (
    "id" TEXT NOT NULL,
    "linkId" TEXT NOT NULL,
    "eventRecipientId" TEXT,
    "weeklyRecipientId" TEXT,
    "isBot" BOOLEAN NOT NULL DEFAULT false,
    "botReason" TEXT,
    "clickedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageLinkClick_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WeeklyEmailRecipient_weeklyEmailId_status_idx" ON "WeeklyEmailRecipient"("weeklyEmailId", "status");

-- CreateIndex
CREATE INDEX "WeeklyEmailRecipient_providerMessageId_idx" ON "WeeklyEmailRecipient"("providerMessageId");

-- CreateIndex
CREATE INDEX "WeeklyEmailRecipient_hackerId_createdAt_idx" ON "WeeklyEmailRecipient"("hackerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyEmailRecipient_weeklyEmailId_hackerId_key" ON "WeeklyEmailRecipient"("weeklyEmailId", "hackerId");

-- CreateIndex
CREATE UNIQUE INDEX "MessageLink_eventCommunicationId_url_key" ON "MessageLink"("eventCommunicationId", "url");

-- CreateIndex
CREATE UNIQUE INDEX "MessageLink_weeklyEmailId_url_key" ON "MessageLink"("weeklyEmailId", "url");

-- CreateIndex
CREATE UNIQUE INDEX "MessageShortLink_linkId_eventRecipientId_key" ON "MessageShortLink"("linkId", "eventRecipientId");

-- CreateIndex
CREATE INDEX "MessageLinkClick_linkId_isBot_idx" ON "MessageLinkClick"("linkId", "isBot");

-- CreateIndex
CREATE INDEX "MessageLinkClick_eventRecipientId_clickedAt_idx" ON "MessageLinkClick"("eventRecipientId", "clickedAt");

-- CreateIndex
CREATE INDEX "MessageLinkClick_weeklyRecipientId_clickedAt_idx" ON "MessageLinkClick"("weeklyRecipientId", "clickedAt");

-- CreateIndex
CREATE INDEX "EventCommunication_eventId_sendGroupId_idx" ON "EventCommunication"("eventId", "sendGroupId");

-- CreateIndex
CREATE INDEX "EventCommunication_sendGroupId_idx" ON "EventCommunication"("sendGroupId");

-- CreateIndex
CREATE INDEX "WeeklyEmail_status_sentAt_idx" ON "WeeklyEmail"("status", "sentAt");

-- AddForeignKey
ALTER TABLE "WeeklyEmailRecipient" ADD CONSTRAINT "WeeklyEmailRecipient_weeklyEmailId_fkey" FOREIGN KEY ("weeklyEmailId") REFERENCES "WeeklyEmail"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyEmailRecipient" ADD CONSTRAINT "WeeklyEmailRecipient_hackerId_fkey" FOREIGN KEY ("hackerId") REFERENCES "Hacker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageLink" ADD CONSTRAINT "MessageLink_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageLink" ADD CONSTRAINT "MessageLink_eventCommunicationId_fkey" FOREIGN KEY ("eventCommunicationId") REFERENCES "EventCommunication"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageLink" ADD CONSTRAINT "MessageLink_weeklyEmailId_fkey" FOREIGN KEY ("weeklyEmailId") REFERENCES "WeeklyEmail"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageShortLink" ADD CONSTRAINT "MessageShortLink_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "MessageLink"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageShortLink" ADD CONSTRAINT "MessageShortLink_eventRecipientId_fkey" FOREIGN KEY ("eventRecipientId") REFERENCES "EventCommunicationRecipient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageLinkClick" ADD CONSTRAINT "MessageLinkClick_linkId_fkey" FOREIGN KEY ("linkId") REFERENCES "MessageLink"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageLinkClick" ADD CONSTRAINT "MessageLinkClick_eventRecipientId_fkey" FOREIGN KEY ("eventRecipientId") REFERENCES "EventCommunicationRecipient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageLinkClick" ADD CONSTRAINT "MessageLinkClick_weeklyRecipientId_fkey" FOREIGN KEY ("weeklyRecipientId") REFERENCES "WeeklyEmailRecipient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

