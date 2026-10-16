-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "judgingEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "judgingOpen" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "judgingSubmissionsCloseAt" TIMESTAMP(3),
ADD COLUMN     "judgingSubmissionsOpenAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "JudgingTrack" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "questionsJson" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JudgingTrack_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JudgingCriterion" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "trackId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JudgingCriterion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventJudge" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "hackerId" TEXT,
    "tokenHash" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSentAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventJudge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventJudgeTrack" (
    "judgeId" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,

    CONSTRAINT "EventJudgeTrack_pkey" PRIMARY KEY ("judgeId","trackId")
);

-- CreateTable
CREATE TABLE "JudgingSubmission" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "trackId" TEXT NOT NULL,
    "answersJson" JSONB NOT NULL,
    "submittedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JudgingSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JudgingReview" (
    "id" TEXT NOT NULL,
    "judgeId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JudgingReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JudgingReviewScore" (
    "reviewId" TEXT NOT NULL,
    "criterionId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,

    CONSTRAINT "JudgingReviewScore_pkey" PRIMARY KEY ("reviewId","criterionId")
);

-- CreateIndex
CREATE INDEX "JudgingTrack_eventId_position_idx" ON "JudgingTrack"("eventId", "position");

-- CreateIndex
CREATE INDEX "JudgingCriterion_eventId_trackId_position_idx" ON "JudgingCriterion"("eventId", "trackId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "EventJudge_tokenHash_key" ON "EventJudge"("tokenHash");

-- CreateIndex
CREATE INDEX "EventJudge_hackerId_idx" ON "EventJudge"("hackerId");

-- CreateIndex
CREATE UNIQUE INDEX "EventJudge_eventId_email_key" ON "EventJudge"("eventId", "email");

-- CreateIndex
CREATE INDEX "EventJudgeTrack_trackId_idx" ON "EventJudgeTrack"("trackId");

-- CreateIndex
CREATE INDEX "JudgingSubmission_trackId_idx" ON "JudgingSubmission"("trackId");

-- CreateIndex
CREATE UNIQUE INDEX "JudgingSubmission_eventId_projectId_key" ON "JudgingSubmission"("eventId", "projectId");

-- CreateIndex
CREATE INDEX "JudgingReview_submissionId_idx" ON "JudgingReview"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "JudgingReview_judgeId_submissionId_key" ON "JudgingReview"("judgeId", "submissionId");

-- CreateIndex
CREATE INDEX "JudgingReviewScore_criterionId_idx" ON "JudgingReviewScore"("criterionId");

-- AddForeignKey
ALTER TABLE "JudgingTrack" ADD CONSTRAINT "JudgingTrack_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JudgingCriterion" ADD CONSTRAINT "JudgingCriterion_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JudgingCriterion" ADD CONSTRAINT "JudgingCriterion_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "JudgingTrack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventJudge" ADD CONSTRAINT "EventJudge_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventJudge" ADD CONSTRAINT "EventJudge_hackerId_fkey" FOREIGN KEY ("hackerId") REFERENCES "Hacker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventJudge" ADD CONSTRAINT "EventJudge_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "Hacker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventJudgeTrack" ADD CONSTRAINT "EventJudgeTrack_judgeId_fkey" FOREIGN KEY ("judgeId") REFERENCES "EventJudge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventJudgeTrack" ADD CONSTRAINT "EventJudgeTrack_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "JudgingTrack"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JudgingSubmission" ADD CONSTRAINT "JudgingSubmission_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JudgingSubmission" ADD CONSTRAINT "JudgingSubmission_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JudgingSubmission" ADD CONSTRAINT "JudgingSubmission_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "JudgingTrack"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JudgingSubmission" ADD CONSTRAINT "JudgingSubmission_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "Hacker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JudgingReview" ADD CONSTRAINT "JudgingReview_judgeId_fkey" FOREIGN KEY ("judgeId") REFERENCES "EventJudge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JudgingReview" ADD CONSTRAINT "JudgingReview_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "JudgingSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JudgingReviewScore" ADD CONSTRAINT "JudgingReviewScore_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "JudgingReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JudgingReviewScore" ADD CONSTRAINT "JudgingReviewScore_criterionId_fkey" FOREIGN KEY ("criterionId") REFERENCES "JudgingCriterion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

