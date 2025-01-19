-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED');

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "preview" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "githubUrl" TEXT,
    "demoUrl" TEXT,
    "blogUrl" TEXT,
    "thumbnailId" TEXT,
    "launchLeadId" TEXT NOT NULL,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'DRAFT',
    "is_starred" BOOLEAN NOT NULL DEFAULT false,
    "is_broken" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubmissionToParticipant" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "hackerId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubmissionToParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubmissionLike" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "hackerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubmissionLike_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_SubmissionDomains" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_SubmissionToWeek" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "_SubmissionTechnologies" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Submission_thumbnailId_key" ON "Submission"("thumbnailId");

-- CreateIndex
CREATE INDEX "Submission_launchLeadId_idx" ON "Submission"("launchLeadId");

-- CreateIndex
CREATE INDEX "SubmissionToParticipant_hackerId_idx" ON "SubmissionToParticipant"("hackerId");

-- CreateIndex
CREATE UNIQUE INDEX "SubmissionToParticipant_submissionId_hackerId_key" ON "SubmissionToParticipant"("submissionId", "hackerId");

-- CreateIndex
CREATE INDEX "SubmissionLike_hackerId_idx" ON "SubmissionLike"("hackerId");

-- CreateIndex
CREATE UNIQUE INDEX "SubmissionLike_submissionId_hackerId_key" ON "SubmissionLike"("submissionId", "hackerId");

-- CreateIndex
CREATE UNIQUE INDEX "_SubmissionDomains_AB_unique" ON "_SubmissionDomains"("A", "B");

-- CreateIndex
CREATE INDEX "_SubmissionDomains_B_index" ON "_SubmissionDomains"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_SubmissionToWeek_AB_unique" ON "_SubmissionToWeek"("A", "B");

-- CreateIndex
CREATE INDEX "_SubmissionToWeek_B_index" ON "_SubmissionToWeek"("B");

-- CreateIndex
CREATE UNIQUE INDEX "_SubmissionTechnologies_AB_unique" ON "_SubmissionTechnologies"("A", "B");

-- CreateIndex
CREATE INDEX "_SubmissionTechnologies_B_index" ON "_SubmissionTechnologies"("B");

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_thumbnailId_fkey" FOREIGN KEY ("thumbnailId") REFERENCES "Image"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_launchLeadId_fkey" FOREIGN KEY ("launchLeadId") REFERENCES "Hacker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionToParticipant" ADD CONSTRAINT "SubmissionToParticipant_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionToParticipant" ADD CONSTRAINT "SubmissionToParticipant_hackerId_fkey" FOREIGN KEY ("hackerId") REFERENCES "Hacker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionLike" ADD CONSTRAINT "SubmissionLike_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionLike" ADD CONSTRAINT "SubmissionLike_hackerId_fkey" FOREIGN KEY ("hackerId") REFERENCES "Hacker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SubmissionDomains" ADD CONSTRAINT "_SubmissionDomains_A_fkey" FOREIGN KEY ("A") REFERENCES "DomainTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SubmissionDomains" ADD CONSTRAINT "_SubmissionDomains_B_fkey" FOREIGN KEY ("B") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SubmissionToWeek" ADD CONSTRAINT "_SubmissionToWeek_A_fkey" FOREIGN KEY ("A") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SubmissionToWeek" ADD CONSTRAINT "_SubmissionToWeek_B_fkey" FOREIGN KEY ("B") REFERENCES "Week"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SubmissionTechnologies" ADD CONSTRAINT "_SubmissionTechnologies_A_fkey" FOREIGN KEY ("A") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_SubmissionTechnologies" ADD CONSTRAINT "_SubmissionTechnologies_B_fkey" FOREIGN KEY ("B") REFERENCES "TechTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
