import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEventDate(dateStr: string): Date {
  const date = new Date(dateStr);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function parseCSVRow(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

interface ParsedRecord {
  email: string;
  metadata: Record<string, string>;
}

function parseCSV(csvText: string): ParsedRecord[] {
  const lines = csvText.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length === 0) return [];

  const headers = parseCSVRow(lines[0]);

  // Find the column whose header contains "email" (case-insensitive)
  const emailColIndex = headers.findIndex((h) =>
    h.toLowerCase().includes("email")
  );

  if (emailColIndex === -1) {
    // No email header — fall back to scanning all cells for emails
    const seen = new Set<string>();
    const records: ParsedRecord[] = [];
    for (const line of lines) {
      for (const cell of parseCSVRow(line)) {
        const trimmed = cell.toLowerCase().replace(/^["']|["']$/g, "");
        if (EMAIL_REGEX.test(trimmed) && !seen.has(trimmed)) {
          seen.add(trimmed);
          records.push({ email: trimmed, metadata: {} });
        }
      }
    }
    return records;
  }

  // Parse rows with full metadata
  const seen = new Set<string>();
  const records: ParsedRecord[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCSVRow(lines[i]);
    const emailCell = cells[emailColIndex];
    if (!emailCell) continue;

    const email = emailCell.toLowerCase().replace(/^["']|["']$/g, "").trim();
    if (!EMAIL_REGEX.test(email) || seen.has(email)) continue;

    seen.add(email);
    const metadata: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      if (j !== emailColIndex && cells[j]) {
        metadata[headers[j]] = cells[j];
      }
    }
    records.push({ email, metadata });
  }
  return records;
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
    const records = parseCSV(csvText);

    if (records.length === 0) {
      return NextResponse.json(
        { error: "No valid emails found in CSV" },
        { status: 400 }
      );
    }

    const result = await prisma.eventCheckIn.createMany({
      data: records.map((record) => ({
        email: record.email,
        eventDate,
        eventLabel: eventLabel || null,
        metadata: Object.keys(record.metadata).length > 0 ? record.metadata : undefined,
      })),
      skipDuplicates: true,
    });

    return NextResponse.json({
      created: result.count,
      skipped: records.length - result.count,
      total: records.length,
    });
  } catch (error) {
    console.error("[CHECKIN_UPLOAD]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
