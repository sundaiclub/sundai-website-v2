ALTER TABLE "Notification" DROP CONSTRAINT "Notification_hackerId_fkey";
ALTER TABLE "PushSubscription" DROP CONSTRAINT "PushSubscription_hackerId_fkey";

DROP TABLE "Notification";
DROP TABLE "PushSubscription";
DROP TYPE "NotificationType";
