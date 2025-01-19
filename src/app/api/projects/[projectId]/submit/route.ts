import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";

// Redirect old project routes to new submission routes
export async function PATCH(
  req: Request,
  { params }: { params: { projectId: string } }
) {
  const url = new URL(req.url);
  return NextResponse.redirect(
    new URL(`/api/submissions/${params.projectId}/status`, url)
  );
}
