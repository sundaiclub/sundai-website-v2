-- CreateEnum
CREATE TYPE "EmailDeliveryBatchStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED');

-- CreateTable
CREATE TABLE "EmailDeliveryBatch" (
    "id" TEXT NOT NULL,
    "eventCommunicationId" TEXT,
    "weeklyEmailId" TEXT,
    "messages" JSONB NOT NULL,
    "status" "EmailDeliveryBatchStatus" NOT NULL DEFAULT 'QUEUED',
    "claimToken" TEXT,
    "claimedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "outcomes" JSONB,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailDeliveryBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailDeliveryRateLimit" (
    "region" TEXT NOT NULL,
    "nextAvailableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailDeliveryRateLimit_pkey" PRIMARY KEY ("region")
);

-- CreateIndex
CREATE INDEX "EmailDeliveryBatch_eventCommunicationId_status_idx" ON "EmailDeliveryBatch"("eventCommunicationId", "status");

-- CreateIndex
CREATE INDEX "EmailDeliveryBatch_weeklyEmailId_status_idx" ON "EmailDeliveryBatch"("weeklyEmailId", "status");

-- CreateIndex
CREATE INDEX "EmailDeliveryBatch_status_publishedAt_idx" ON "EmailDeliveryBatch"("status", "publishedAt");

-- AddForeignKey
ALTER TABLE "EmailDeliveryBatch" ADD CONSTRAINT "EmailDeliveryBatch_eventCommunicationId_fkey" FOREIGN KEY ("eventCommunicationId") REFERENCES "EventCommunication"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailDeliveryBatch" ADD CONSTRAINT "EmailDeliveryBatch_weeklyEmailId_fkey" FOREIGN KEY ("weeklyEmailId") REFERENCES "WeeklyEmail"("id") ON DELETE SET NULL ON UPDATE CASCADE;
