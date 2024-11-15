import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function DELETE(
  request: Request,
  { params }: { params: { projectId: string; hackerId: string } }
) {
  try {
    const { projectId, hackerId } = params;

    await prisma.projectToParticipant.delete({
      where: {
        hackerId_projectId: {
          hackerId,
          projectId,
        },
      },
    });

    return NextResponse.json({ message: "Participant removed successfully" });
  } catch (error) {
    console.error("Error removing participant:", error);
    return NextResponse.json(
      { error: "Error removing participant" },
      { status: 500 }
    );
  }
}
