import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { userId } = auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const admin = await prisma.hacker.findUnique({
      where: { clerkId: userId },
      select: { id: true, role: true },
    });

    if (admin?.role !== "ADMIN") {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { token } = await req.json();
    if (!token) {
      return new NextResponse("Token is required", { status: 400 });
    }

    const record = await prisma.eventCheckIn.findUnique({
      where: { id: token },
    });

    if (!record) {
      return NextResponse.json({ status: "not_found" }, { status: 404 });
    }

    if (record.checkedIn) {
      return NextResponse.json({
        status: "already_checked_in",
        email: record.email,
        checkedInAt: record.checkedInAt,
      });
    }

    const updated = await prisma.eventCheckIn.update({
      where: { id: token },
      data: {
        checkedIn: true,
        checkedInAt: new Date(),
        checkedInBy: admin.id,
      },
    });

    return NextResponse.json({
      status: "success",
      email: updated.email,
    });
  } catch (error) {
    console.error("[CHECKIN_VERIFY]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
