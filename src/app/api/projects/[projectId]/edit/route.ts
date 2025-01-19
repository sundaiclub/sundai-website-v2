import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { uploadToGCS } from "@/lib/gcp-storage";
import prisma from "@/lib/prisma";

// Redirect old project edit routes to new submission edit routes
export async function PATCH(
  req: Request,
  { params }: { params: { projectId: string } }
) {
  const url = new URL(req.url);
  return NextResponse.redirect(
    new URL(`/api/submissions/${params.projectId}/edit`, url)
  );
}
