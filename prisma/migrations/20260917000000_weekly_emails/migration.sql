CREATE TYPE "WeeklyEmailStatus" AS ENUM ('DRAFT', 'SENDING', 'SENT');
CREATE TABLE "WeeklyEmail" (
    "id" TEXT NOT NULL,
    "subject" VARCHAR(200) NOT NULL,
    "body" TEXT NOT NULL,
    "status" "WeeklyEmailStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WeeklyEmail_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "WeeklyEmail_status_updatedAt_idx" ON "WeeklyEmail"("status", "updatedAt");
