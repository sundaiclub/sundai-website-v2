ALTER TYPE "EventCommunicationRecipientStatus" ADD VALUE 'DELIVERED';
ALTER TYPE "EventCommunicationRecipientStatus" ADD VALUE 'UNDELIVERED';

CREATE INDEX "EventCommunicationRecipient_providerMessageId_idx"
ON "EventCommunicationRecipient"("providerMessageId");

CREATE INDEX "EventPublicationNotificationRecipient_providerMessageId_idx"
ON "EventPublicationNotificationRecipient"("providerMessageId");

CREATE TYPE "SmsPreferenceEventType" AS ENUM ('STOP', 'HELP', 'START');

CREATE TABLE "SmsPreferenceEvent" (
    "id" TEXT NOT NULL,
    "providerSid" TEXT NOT NULL,
    "type" "SmsPreferenceEventType" NOT NULL,
    "fromNumber" TEXT NOT NULL,
    "toNumber" TEXT,
    "hackerId" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SmsPreferenceEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SmsPreferenceEvent_providerSid_key" ON "SmsPreferenceEvent"("providerSid");
CREATE INDEX "SmsPreferenceEvent_fromNumber_receivedAt_idx" ON "SmsPreferenceEvent"("fromNumber", "receivedAt");
CREATE INDEX "SmsPreferenceEvent_hackerId_receivedAt_idx" ON "SmsPreferenceEvent"("hackerId", "receivedAt");

ALTER TABLE "SmsPreferenceEvent"
ADD CONSTRAINT "SmsPreferenceEvent_hackerId_fkey"
FOREIGN KEY ("hackerId") REFERENCES "Hacker"("id") ON DELETE SET NULL ON UPDATE CASCADE;
