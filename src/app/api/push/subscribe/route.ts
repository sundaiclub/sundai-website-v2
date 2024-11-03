import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs";
import prisma from "@/lib/prisma";
import webpush from "web-push";

// Configure web-push with your VAPID keys
webpush.setVapidDetails(
  "mailto:your-email@example.com",
  process.env.VAPID_PUBLIC_KEY || "",
  process.env.VAPID_PRIVATE_KEY || ""
);

export async function POST(req: Request) {
  try {
    const { userId } = auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { subscription, preferences } = await req.json();

    // Get the hacker
    const hacker = await prisma.hacker.findUnique({
      where: { discordId: userId },
    });

    if (!hacker) {
      return new NextResponse("Hacker not found", { status: 404 });
    }

    // Create or update subscription
    const pushSubscription = await prisma.pushSubscription.upsert({
      where: {
        endpoint: subscription.endpoint,
      },
      update: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        ...preferences,
      },
      create: {
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        hackerId: hacker.id,
        ...preferences,
      },
    });

    return NextResponse.json(pushSubscription);
  } catch (error) {
    console.error("[PUSH_SUBSCRIBE]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { userId } = auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { endpoint } = await req.json();

    await prisma.pushSubscription.delete({
      where: {
        endpoint,
      },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("[PUSH_UNSUBSCRIBE]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
