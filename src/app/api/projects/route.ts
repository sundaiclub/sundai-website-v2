// Delete this file as it's being replaced by submissions/route.ts

import { NextResponse } from "next/server";

// Redirect all project requests to submissions
export async function GET(req: Request) {
  const url = new URL(req.url);
  return NextResponse.redirect(new URL("/api/submissions" + url.search, url));
}

export async function POST(req: Request) {
  const url = new URL(req.url);
  return NextResponse.redirect(new URL("/api/submissions", url));
}
