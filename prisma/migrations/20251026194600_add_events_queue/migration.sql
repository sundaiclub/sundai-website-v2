-- Create Enum
CREATE TYPE "EventProjectStatus" AS ENUM ('QUEUED', 'APPROVED', 'CURRENT', 'DONE', 'SKIPPED');

-- CreateTable Event
CREATE TABLE "Event" (
  "id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "startTime" TIMESTAMP(3) NOT NULL,
  "meetingUrl" TEXT,
  "location" TEXT,
  "createdById" TEXT NOT NULL,
  "audienceCanReorder" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable EventMC
CREATE TABLE "EventMC" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "hackerId" TEXT NOT NULL,
  "role" TEXT,

  CONSTRAINT "EventMC_pkey" PRIMARY KEY ("id")
);

-- CreateTable EventProject
CREATE TABLE "EventProject" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "addedById" TEXT NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "status" "EventProjectStatus" NOT NULL DEFAULT 'QUEUED',
  "approved" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "EventProject_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "Event_startTime_idx" ON "Event"("startTime");

CREATE UNIQUE INDEX "EventMC_eventId_hackerId_key" ON "EventMC"("eventId", "hackerId");
CREATE INDEX "EventMC_hackerId_idx" ON "EventMC"("hackerId");

CREATE UNIQUE INDEX "EventProject_eventId_projectId_key" ON "EventProject"("eventId", "projectId");
CREATE INDEX "EventProject_eventId_position_idx" ON "EventProject"("eventId", "position");
CREATE INDEX "EventProject_status_idx" ON "EventProject"("status");

-- Foreign Keys
ALTER TABLE "Event" ADD CONSTRAINT "Event_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Hacker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EventMC" ADD CONSTRAINT "EventMC_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EventMC" ADD CONSTRAINT "EventMC_hackerId_fkey" FOREIGN KEY ("hackerId") REFERENCES "Hacker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EventProject" ADD CONSTRAINT "EventProject_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EventProject" ADD CONSTRAINT "EventProject_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EventProject" ADD CONSTRAINT "EventProject_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "Hacker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


