ALTER TYPE "EventCommunicationAudience" ADD VALUE 'CHAPTER_MEMBERS';

ALTER TABLE "EventCommunicationRecipient"
  ALTER COLUMN "registrationId" DROP NOT NULL;
