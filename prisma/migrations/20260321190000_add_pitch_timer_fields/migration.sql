-- CreateEnum
CREATE TYPE "PitchPhase" AS ENUM ('WAITING', 'PRESENTING', 'QUESTIONS', 'COMPLETED');

-- AlterTable
ALTER TABLE "EventProject" ADD COLUMN     "pitchPhase" "PitchPhase" NOT NULL DEFAULT 'WAITING',
ADD COLUMN     "presentingStartedAt" TIMESTAMP(3),
ADD COLUMN     "questionsStartedAt" TIMESTAMP(3),
ADD COLUMN     "completedAt" TIMESTAMP(3),
ADD COLUMN     "allottedPresentingSec" INTEGER,
ADD COLUMN     "allottedQuestionsSec" INTEGER;
