-- CreateTable
CREATE TABLE "EventIdea" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "hackerId" TEXT,
    "name" TEXT NOT NULL,
    "idea" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventIdea_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventIdea_eventId_createdAt_idx" ON "EventIdea"("eventId", "createdAt");

-- CreateIndex
CREATE INDEX "EventIdea_hackerId_idx" ON "EventIdea"("hackerId");

-- AddForeignKey
ALTER TABLE "EventIdea" ADD CONSTRAINT "EventIdea_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventIdea" ADD CONSTRAINT "EventIdea_hackerId_fkey" FOREIGN KEY ("hackerId") REFERENCES "Hacker"("id") ON DELETE SET NULL ON UPDATE CASCADE;

