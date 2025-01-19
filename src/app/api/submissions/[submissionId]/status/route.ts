import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";

export async function PATCH(
  req: Request,
  { params }: { params: { submissionId: string } }
) {
  try {
    const { userId } = auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const data = await req.json();
    const { status } = data;

    const submission = await prisma.submission.update({
      where: {
        id: params.submissionId,
      },
      data: {
        status,
      },
    });

    return NextResponse.json(submission);
  } catch (error) {
    console.error("[SUBMISSION_STATUS_PATCH]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
