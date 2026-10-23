CREATE TABLE "EventStaffInvitation" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "invitedById" TEXT NOT NULL,
    "acceptedById" TEXT,
    "acceptedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EventStaffInvitation_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EventStaffInvitation_eventId_email_key" ON "EventStaffInvitation"("eventId", "email");
CREATE INDEX "EventStaffInvitation_eventId_createdAt_idx" ON "EventStaffInvitation"("eventId", "createdAt");
ALTER TABLE "EventStaffInvitation" ADD CONSTRAINT "EventStaffInvitation_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventStaffInvitation" ADD CONSTRAINT "EventStaffInvitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "Hacker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EventStaffInvitation" ADD CONSTRAINT "EventStaffInvitation_acceptedById_fkey" FOREIGN KEY ("acceptedById") REFERENCES "Hacker"("id") ON DELETE SET NULL ON UPDATE CASCADE;
