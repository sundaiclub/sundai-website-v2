-- CreateTable
CREATE TABLE "EventCheckIn" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "eventDate" TIMESTAMP(3) NOT NULL,
    "eventLabel" TEXT,
    "checkedIn" BOOLEAN NOT NULL DEFAULT false,
    "checkedInAt" TIMESTAMP(3),
    "checkedInBy" TEXT,
    "emailSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventCheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventCheckIn_eventDate_idx" ON "EventCheckIn"("eventDate");

-- CreateIndex
CREATE INDEX "EventCheckIn_email_idx" ON "EventCheckIn"("email");

-- CreateIndex
CREATE UNIQUE INDEX "EventCheckIn_email_eventDate_key" ON "EventCheckIn"("email", "eventDate");
