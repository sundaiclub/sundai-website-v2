import { PrismaClient } from "@prisma/client";
import { NextResponse } from "next/server";

const prisma = new PrismaClient();

export async function POST(
  request: Request,
  { params }: { params: { projectId: string } }
) {
  try {
    const { hackerId, role } = await request.json();
    const projectId = params.projectId;

    // Check if user is already a participant
    const existingParticipant = await prisma.projectToParticipant.findUnique({
      where: {
        hackerId_projectId: {
          hackerId,
          projectId,
        },
      },
    });

    if (existingParticipant) {
      return NextResponse.json(
        { error: "Already a participant" },
        { status: 400 }
      );
    }

    // Add user as participant
    const participant = await prisma.projectToParticipant.create({
      data: {
        hackerId,
        projectId,
        role,
      },
    });

    return NextResponse.json(participant);
  } catch (error) {
    console.error("Error joining project:", error);
    return NextResponse.json(
      { error: "Error joining project" },
      { status: 500 }
    );
  }
}
