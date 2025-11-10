-- Add isFinished flag to Events to lock queue after event completion
ALTER TABLE "Event" ADD COLUMN "isFinished" BOOLEAN NOT NULL DEFAULT false;


