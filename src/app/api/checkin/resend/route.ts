import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { sendQREmail } from "@/lib/email";

export async function POST(req: Request) {
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

    const { registrationId } = await req.json();
    if (!registrationId) {
      return new NextResponse("registrationId is required", { status: 400 });
    }

    const record = await prisma.eventCheckIn.findUnique({
      where: { id: registrationId },
    });

    if (!record) {
      return new NextResponse("Registration not found", { status: 404 });
    }

    await sendQREmail(
      record.email,
      record.eventLabel,
      record.eventDate,
      record.id
    );

    await prisma.eventCheckIn.update({
      where: { id: record.id },
      data: { emailSentAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[CHECKIN_RESEND]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
