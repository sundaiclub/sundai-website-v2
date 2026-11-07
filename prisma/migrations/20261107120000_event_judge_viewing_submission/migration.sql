ALTER TABLE "EventJudge" ADD COLUMN "viewingSubmissionId" TEXT;

ALTER TABLE "EventJudge" ADD CONSTRAINT "EventJudge_viewingSubmissionId_fkey" FOREIGN KEY ("viewingSubmissionId") REFERENCES "JudgingSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
