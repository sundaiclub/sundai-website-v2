import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";

function normalizeEventDate(dateStr: string): Date {
  const date = new Date(dateStr);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

export async function GET(req: Request) {
  try {
    const { userId } = auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const user = await prisma.hacker.findUnique({
      where: { clerkId: userId },
      select: { role: true },
    });

    if (user?.role !== "ADMIN") {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const eventDateStr = searchParams.get("eventDate");

    if (!eventDateStr) {
      return new NextResponse("eventDate is required", { status: 400 });
    }

    const eventDate = normalizeEventDate(eventDateStr);

    const registrations = await prisma.eventCheckIn.findMany({
      where: { eventDate },
      orderBy: { email: "asc" },
    });

    const total = registrations.length;
    const checkedIn = registrations.filter((r) => r.checkedIn).length;
    const emailsSent = registrations.filter((r) => r.emailSentAt).length;

    return NextResponse.json({
      registrations,
      stats: {
        total,
        checkedIn,
        pending: total - checkedIn,
        emailsSent,
        emailsPending: total - emailsSent,
      },
    });
  } catch (error) {
    console.error("[CHECKIN_REGISTRATIONS]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
