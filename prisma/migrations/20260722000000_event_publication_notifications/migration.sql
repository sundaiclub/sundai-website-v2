CREATE TABLE "EventPublicationNotification" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "status" "EventCommunicationStatus" NOT NULL DEFAULT 'SENDING',
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "emailRecipientCount" INTEGER NOT NULL DEFAULT 0,
    "smsRecipientCount" INTEGER NOT NULL DEFAULT 0,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventPublicationNotification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EventPublicationNotificationRecipient" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "hackerId" TEXT NOT NULL,
    "channel" "EventCommunicationChannel" NOT NULL,
    "contactValue" TEXT NOT NULL,
    "status" "EventCommunicationRecipientStatus" NOT NULL DEFAULT 'PENDING',
    "providerMessageId" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "attemptedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventPublicationNotificationRecipient_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EventPublicationNotification_eventId_key" ON "EventPublicationNotification"("eventId");
CREATE INDEX "EventPublicationNotification_eventId_createdAt_idx" ON "EventPublicationNotification"("eventId", "createdAt");
CREATE INDEX "EventPublicationNotification_requestedById_createdAt_idx" ON "EventPublicationNotification"("requestedById", "createdAt");
CREATE UNIQUE INDEX "EventPublicationNotificationRecipient_notificationId_hackerId_channel_key" ON "EventPublicationNotificationRecipient"("notificationId", "hackerId", "channel");
CREATE INDEX "EventPublicationNotificationRecipient_notificationId_status_idx" ON "EventPublicationNotificationRecipient"("notificationId", "status");
CREATE INDEX "EventPublicationNotificationRecipient_hackerId_createdAt_idx" ON "EventPublicationNotificationRecipient"("hackerId", "createdAt");

ALTER TABLE "EventPublicationNotification" ADD CONSTRAINT "EventPublicationNotification_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EventPublicationNotification" ADD CONSTRAINT "EventPublicationNotification_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "Hacker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EventPublicationNotificationRecipient" ADD CONSTRAINT "EventPublicationNotificationRecipient_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "EventPublicationNotification"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EventPublicationNotificationRecipient" ADD CONSTRAINT "EventPublicationNotificationRecipient_hackerId_fkey" FOREIGN KEY ("hackerId") REFERENCES "Hacker"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
