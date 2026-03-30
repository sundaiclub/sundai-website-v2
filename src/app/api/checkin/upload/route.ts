import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEventDate(dateStr: string): Date {
  const date = new Date(dateStr);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function parseEmails(csvText: string): string[] {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim());
  const emails: string[] = [];

  for (const line of lines) {
    // Split by comma to handle multi-column CSVs
    const cells = line.split(",");
    for (const cell of cells) {
      const trimmed = cell.trim().toLowerCase().replace(/^["']|["']$/g, "");
      if (EMAIL_REGEX.test(trimmed)) {
        emails.push(trimmed);
      }
    }
  }

  return [...new Set(emails)];
}

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

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const eventDateStr = formData.get("eventDate") as string | null;
    const eventLabel = formData.get("eventLabel") as string | null;

    if (!file || !eventDateStr) {
      return new NextResponse("File and eventDate are required", {
        status: 400,
      });
    }

    const eventDate = normalizeEventDate(eventDateStr);
    const csvText = await file.text();
    const emails = parseEmails(csvText);

    if (emails.length === 0) {
      return NextResponse.json(
        { error: "No valid emails found in CSV" },
        { status: 400 }
      );
    }

    const result = await prisma.eventCheckIn.createMany({
      data: emails.map((email) => ({
        email,
        eventDate,
        eventLabel: eventLabel || null,
      })),
      skipDuplicates: true,
    });

    return NextResponse.json({
      created: result.count,
      skipped: emails.length - result.count,
      total: emails.length,
    });
  } catch (error) {
    console.error("[CHECKIN_UPLOAD]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
