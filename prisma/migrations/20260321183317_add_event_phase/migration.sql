-- CreateEnum
CREATE TYPE "EventPhase" AS ENUM ('VOTING', 'PITCHING');

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "phase" "EventPhase" NOT NULL DEFAULT 'VOTING';

-- Update existing events to PITCHING
UPDATE "Event" SET "phase" = 'PITCHING';
