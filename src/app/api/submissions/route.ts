import { SubmissionStatus, Role } from "@prisma/client";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const submissions = await prisma.submission.findMany({
      where: status ? { status: status as SubmissionStatus } : undefined,
      include: {
        thumbnail: {
          select: {
            url: true,
            alt: true,
          },
        },
        launchLead: {
          include: {
            avatar: true,
          },
        },
        participants: {
          include: {
            hacker: {
              include: {
                avatar: true,
              },
            },
          },
        },
        likes: {
          select: {
            hackerId: true,
            createdAt: true,
          },
        },
      },
      orderBy: [
        {
          is_starred: "desc",
        },
        {
          createdAt: "desc",
        },
      ],
    });

    return NextResponse.json(submissions);
  } catch (error) {
    console.error("[SUBMISSIONS_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const data = await req.json();
    const {
      title,
      preview,
      description,
      githubUrl,
      demoUrl,
      blogUrl,
      techTags,
      domainTags,
      participants,
      weekId,
    } = data;

    const user = await prisma.hacker.findFirst({
      where: { clerkId: userId },
    });

    if (!user) {
      return new NextResponse("User not found", { status: 404 });
    }

    const submission = await prisma.submission.create({
      data: {
        title,
        preview,
        description,
        githubUrl,
        demoUrl,
        blogUrl,
        launchLeadId: user.id,
        status: SubmissionStatus.DRAFT,
        participants: {
          create: participants.map(
            (participant: { id: string; role: string }) => ({
              hackerId: participant.id,
              role: participant.role,
            })
          ),
        },
        techTags: {
          connectOrCreate: techTags.map((tag: string) => ({
            where: { name: tag },
            create: { name: tag },
          })),
        },
        domainTags: {
          connectOrCreate: domainTags.map((tag: string) => ({
            where: { name: tag },
            create: { name: tag },
          })),
        },
        weeks: weekId
          ? {
              connect: { id: weekId },
            }
          : undefined,
      },
      include: {
        thumbnail: true,
        launchLead: {
          include: {
            avatar: true,
          },
        },
        participants: {
          include: {
            hacker: {
              include: {
                avatar: true,
              },
            },
          },
        },
        techTags: true,
        domainTags: true,
        weeks: true,
      },
    });

    return NextResponse.json(submission);
  } catch (error) {
    console.error("[SUBMISSIONS_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
