import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { sendQREmail } from "@/lib/email";

function normalizeEventDate(dateStr: string): Date {
  const date = new Date(dateStr);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

    const { eventDate: eventDateStr } = await req.json();
    if (!eventDateStr) {
      return new NextResponse("eventDate is required", { status: 400 });
    }

    const eventDate = normalizeEventDate(eventDateStr);

    const pending = await prisma.eventCheckIn.findMany({
      where: {
        eventDate,
        emailSentAt: null,
      },
    });

    if (pending.length === 0) {
      return NextResponse.json({
        sent: 0,
        failed: 0,
        failedEmails: [],
        message: "No pending emails to send",
      });
    }

    let sent = 0;
    const failedEmails: string[] = [];
    const BATCH_SIZE = 10;
    const BATCH_DELAY_MS = 200;
    const MAX_RETRIES = 3;

    for (let i = 0; i < pending.length; i += BATCH_SIZE) {
      const batch = pending.slice(i, i + BATCH_SIZE);

      const results = await Promise.allSettled(
        batch.map(async (record) => {
          let lastError: Error | null = null;

          for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
            try {
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

              return { success: true, email: record.email };
            } catch (error) {
              lastError = error as Error;
              // Exponential backoff: 1s, 2s, 4s
              if (attempt < MAX_RETRIES - 1) {
                await sleep(1000 * Math.pow(2, attempt));
              }
            }
          }

          throw lastError;
        })
      );

      for (const result of results) {
        if (result.status === "fulfilled") {
          sent++;
        } else {
          const email =
            batch[results.indexOf(result)]?.email || "unknown";
          failedEmails.push(email);
          console.error(
            `[CHECKIN_EMAIL] Failed to send to ${email}:`,
            result.reason
          );
        }
      }

      // Delay between batches to avoid SMTP rate limits
      if (i + BATCH_SIZE < pending.length) {
        await sleep(BATCH_DELAY_MS);
      }
    }

    return NextResponse.json({
      sent,
      failed: failedEmails.length,
      failedEmails,
    });
  } catch (error) {
    console.error("[CHECKIN_SEND_EMAILS]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
