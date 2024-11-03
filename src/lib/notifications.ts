import webpush from "web-push";
import prisma from "./prisma";
import { NotificationType } from "@prisma/client";

export async function sendNotification(
  hackerId: string,
  type: NotificationType,
  title: string,
  body: string,
  icon?: string,
  data?: any
) {
  try {
    // Create notification record
    const notification = await prisma.notification.create({
      data: {
        type,
        title,
        body,
        icon,
        data,
        hackerId,
      },
    });

    // Get all subscriptions for the hacker
    const subscriptions = await prisma.pushSubscription.findMany({
      where: {
        hackerId,
        // Check notification preferences based on type
        ...(type === "NEW_PROJECT" && { notifyNewProjects: true }),
        ...(type === "PROJECT_UPDATE" && { notifyProjectUpdates: true }),
        ...(type === "NEW_LIKE" && { notifyLikes: true }),
        ...(type === "NEW_MEMBER" && { notifyNewMembers: true }),
      },
    });

    // Send push notification to all subscriptions
    const pushPromises = subscriptions.map((sub) =>
      webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        },
        JSON.stringify({
          title,
          body,
          icon,
          data: {
            ...data,
            notificationId: notification.id,
          },
        })
      )
    );

    await Promise.allSettled(pushPromises);
  } catch (error) {
    console.error("Error sending notification:", error);
  }
}
