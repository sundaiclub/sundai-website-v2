import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import {
  ApplicationTemplateValidationError,
  parseTemplateFieldsJson,
} from "@/lib/applicationTemplates";
import { canManageEventSettings } from "@/lib/eventManagementAuth";

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "event";
}

export async function GET(
  req: Request,
  { params }: { params: { eventId: string } }
) {
  try {
    const event = await prisma.event.findUnique({
      where: { id: params.eventId },
      include: {
        staff: { include: { hacker: { include: { avatar: true } } } },
        projects: {
          orderBy: { position: "asc" },
          include: {
            pitchVotes: { select: { hackerId: true, value: true, createdAt: true } },
            project: {
              include: {
                thumbnail: true,
                launchLead: { include: { avatar: true } },
                participants: { include: { hacker: { include: { avatar: true } } } },
                techTags: true,
                domainTags: true,
                likes: { select: { hackerId: true, createdAt: true } },
              },
            },
          },
        },
      },
    });

    if (!event) return new NextResponse("Not Found", { status: 404 });

    return NextResponse.json(event);
  } catch (error) {
    console.error("[EVENT_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { eventId: string } }
) {
  try {
    const { userId } = auth();
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });

    const user = await prisma.hacker.findUnique({
      where: { clerkId: userId },
      select: { id: true, role: true },
    });
    if (!user) return new NextResponse("Unauthorized", { status: 401 });

    const canManage = await canManageEventSettings(prisma, user.id, params.eventId);
    if (!canManage) return new NextResponse("Forbidden", { status: 403 });

    const existingEvent = await prisma.event.findUnique({
      where: { id: params.eventId },
      select: {
        phase: true,
        topPresentingSec: true,
        topQuestionsSec: true,
        defaultPresentingSec: true,
        defaultQuestionsSec: true,
        chapterId: true,
      },
    });
    if (!existingEvent) return new NextResponse("Not Found", { status: 404 });

    const body = await req.json();
    const {
      title,
      description,
      startTime,
      endTime,
      meetingUrl,
      location,
      venueName,
      publicLocation,
      address,
      virtualUrl,
      slug,
      status,
      visibility,
      programType,
      publicProgramLabel,
      capacity,
      applicationMode,
      autoPromoteWaitlist,
      approvedDetailsJson,
      applicationQuestionsJson,
      hideChapterDefaultQuestions,
      applicationsOpen,
      applicationsCloseReason,
      checkInOpensAt,
      checkInClosesAt,
      mcIds,
      votingEndTime,
      topProjectCount,
      topPresentingSec,
      topQuestionsSec,
      defaultPresentingSec,
      defaultQuestionsSec,
    } = body;

    if (applicationQuestionsJson !== undefined) {
      parseTemplateFieldsJson(applicationQuestionsJson, "applicationQuestionsJson", {
        allowSiteRequiredFieldIds: false,
      });
    }

    const nextTopPresentingSec = topPresentingSec ?? existingEvent.topPresentingSec;
    const nextTopQuestionsSec = topQuestionsSec ?? existingEvent.topQuestionsSec;
    const nextDefaultPresentingSec = defaultPresentingSec ?? existingEvent.defaultPresentingSec;
    const nextDefaultQuestionsSec = defaultQuestionsSec ?? existingEvent.defaultQuestionsSec;
    const timingConfigChanged =
      topPresentingSec !== undefined ||
      topQuestionsSec !== undefined ||
      defaultPresentingSec !== undefined ||
      defaultQuestionsSec !== undefined;

    const eventUpdate = prisma.event.update({
      where: { id: params.eventId },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description: description || null }),
        ...(startTime !== undefined && { startTime: new Date(startTime) }),
        ...(endTime !== undefined && { endTime: endTime ? new Date(endTime) : null }),
        ...(meetingUrl !== undefined && { meetingUrl: meetingUrl || null }),
        ...(location !== undefined && { location: location || null }),
        ...(venueName !== undefined && { venueName: venueName || null }),
        ...(publicLocation !== undefined && { publicLocation: publicLocation || null }),
        ...(address !== undefined && { address: address || null }),
        ...(virtualUrl !== undefined && { virtualUrl: virtualUrl || null }),
        ...(slug !== undefined && { slug: slugify(slug || title || params.eventId) }),
        ...(status !== undefined && { status }),
        ...(visibility !== undefined && { visibility }),
        ...(programType !== undefined && { programType: programType || null }),
        ...(publicProgramLabel !== undefined && { publicProgramLabel: publicProgramLabel || null }),
        ...(capacity !== undefined && { capacity: capacity === null ? null : Number(capacity) }),
        ...(applicationMode !== undefined && { applicationMode }),
        ...(autoPromoteWaitlist !== undefined && { autoPromoteWaitlist: Boolean(autoPromoteWaitlist) }),
        ...(approvedDetailsJson !== undefined && { approvedDetailsJson }),
        ...(applicationQuestionsJson !== undefined && { applicationQuestionsJson }),
        ...(hideChapterDefaultQuestions !== undefined && { hideChapterDefaultQuestions: Boolean(hideChapterDefaultQuestions) }),
        ...(applicationsOpen !== undefined && { applicationsOpen: applicationsOpen ? new Date(applicationsOpen) : null }),
        ...(applicationsCloseReason !== undefined && { applicationsCloseReason: applicationsCloseReason || null }),
        ...(checkInOpensAt !== undefined && { checkInOpensAt: checkInOpensAt ? new Date(checkInOpensAt) : null }),
        ...(checkInClosesAt !== undefined && { checkInClosesAt: checkInClosesAt ? new Date(checkInClosesAt) : null }),
        ...(votingEndTime !== undefined && { votingEndTime: votingEndTime ? new Date(votingEndTime) : null }),
        ...(topProjectCount !== undefined && { topProjectCount }),
        ...(topPresentingSec !== undefined && { topPresentingSec }),
        ...(topQuestionsSec !== undefined && { topQuestionsSec }),
        ...(defaultPresentingSec !== undefined && { defaultPresentingSec }),
        ...(defaultQuestionsSec !== undefined && { defaultQuestionsSec }),
      },
    });

    if (timingConfigChanged && existingEvent.phase === "PITCHING") {
      await prisma.$transaction([
        eventUpdate,
        prisma.eventProject.updateMany({
          where: {
            eventId: params.eventId,
            isTopProject: true,
            status: { in: ["CURRENT", "APPROVED"] },
          },
          data: {
            allottedPresentingSec: nextTopPresentingSec,
            allottedQuestionsSec: nextTopQuestionsSec,
          },
        }),
        prisma.eventProject.updateMany({
          where: {
            eventId: params.eventId,
            isTopProject: false,
            status: { in: ["CURRENT", "APPROVED"] },
          },
          data: {
            allottedPresentingSec: nextDefaultPresentingSec,
            allottedQuestionsSec: nextDefaultQuestionsSec,
          },
        }),
      ]);
    } else {
      await eventUpdate;
    }

    if (mcIds !== undefined) {
      await prisma.eventStaff.deleteMany({
        where: { eventId: params.eventId, role: "MC" },
      });
      if (mcIds.length > 0) {
        await prisma.eventStaff.createMany({
          data: mcIds.map((hackerId: string) => ({
            eventId: params.eventId,
            hackerId,
            role: "MC" as const,
          })),
        });
      }
    }

    const event = await prisma.event.findUnique({
      where: { id: params.eventId },
      include: {
        staff: { include: { hacker: { include: { avatar: true } } } },
        projects: {
          orderBy: { position: "asc" },
          include: {
            pitchVotes: { select: { hackerId: true, value: true, createdAt: true } },
            project: {
              include: {
                thumbnail: true,
                launchLead: { include: { avatar: true } },
                participants: { include: { hacker: { include: { avatar: true } } } },
                techTags: true,
                domainTags: true,
                likes: { select: { hackerId: true, createdAt: true } },
              },
            },
          },
        },
      },
    });

    return NextResponse.json(event);
  } catch (error) {
    if (error instanceof ApplicationTemplateValidationError) {
      return NextResponse.json(
        { message: error.message, issues: error.issues },
        { status: 400 }
      );
    }
    console.error("[EVENT_PATCH]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
