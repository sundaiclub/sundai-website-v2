import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { canManageChapterSettings } from "@/lib/eventManagementAuth";
import {
  ApplicationTemplateValidationError,
  parseTemplateFieldsJson,
} from "@/lib/applicationTemplates";

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "event";
}

export async function GET(req: Request) {
  try {
    const searchParams = new URL(req.url).searchParams;
    const organizerOnly =
      searchParams.get("organizer") === "true" ||
      searchParams.get("manageable") === "true";
    const { userId } = auth();
    if (organizerOnly && !userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const user = userId
      ? await prisma.hacker.findUnique({
          where: { clerkId: userId },
          select: { id: true, role: true },
        })
      : null;
    if (organizerOnly && !user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const chapterAdminMemberships =
      user && user.role !== "SITE_ADMIN"
        ? await prisma.chapterMembership.findMany({
            where: {
              hackerId: user.id,
              role: "ADMIN",
              status: "ACTIVE",
            },
            select: { chapterId: true },
          })
        : [];
    const manageableChapterIds = chapterAdminMemberships.map(
      (membership) => membership.chapterId
    );
    if (
      organizerOnly &&
      user?.role !== "SITE_ADMIN" &&
      manageableChapterIds.length === 0
    ) {
      return new NextResponse("Forbidden", { status: 403 });
    }

    const events = await prisma.event.findMany({
      where: organizerOnly
        ? user?.role === "SITE_ADMIN"
          ? undefined
          : { chapterId: { in: manageableChapterIds } }
        : user?.role === "SITE_ADMIN" || manageableChapterIds.length === 0
          ? undefined
          : { chapterId: { in: manageableChapterIds } },
      orderBy: { startTime: "desc" },
      include: {
        chapter: { select: { id: true, name: true, slug: true } },
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
            // include scalar fields like addedById by default
          },
        },
      },
    });

    return NextResponse.json(events);
  } catch (error) {
    console.error("[EVENTS_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = auth();
    if (!userId) return new NextResponse("Unauthorized", { status: 401 });

    const user = await prisma.hacker.findUnique({
      where: { clerkId: userId },
      select: { id: true, role: true },
    });
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
      chapterId = "boston",
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
      mcIds = [],
      audienceCanReorder = true,
      votingEndTime,
      topProjectCount,
      topPresentingSec,
      topQuestionsSec,
      defaultPresentingSec,
      defaultQuestionsSec,
    } = body || {};
    const canCreate =
      user?.role === "SITE_ADMIN" ||
      (user && (await canManageChapterSettings(prisma, user.id, chapterId)));
    if (!canCreate) return new NextResponse("Forbidden", { status: 403 });

    if (!title || !startTime) {
      return NextResponse.json({ message: "title and startTime are required" }, { status: 400 });
    }

    if (applicationQuestionsJson !== undefined) {
      parseTemplateFieldsJson(applicationQuestionsJson, "applicationQuestionsJson", {
        allowSiteRequiredFieldIds: false,
      });
    }

    const event = await prisma.event.create({
      data: {
        title,
        description: description || null,
        startTime: new Date(startTime),
        ...(endTime !== undefined && { endTime: endTime ? new Date(endTime) : null }),
        chapterId,
        slug: slugify(slug || title),
        meetingUrl: meetingUrl || null,
        location: location || null,
        venueName: venueName || null,
        publicLocation: publicLocation ?? location ?? null,
        address: address || null,
        virtualUrl: virtualUrl ?? meetingUrl ?? null,
        createdById: user.id,
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
        audienceCanReorder,
        votingEndTime: votingEndTime ? new Date(votingEndTime) : new Date(new Date(startTime).getTime() + 15 * 60 * 1000),
        ...(topProjectCount !== undefined && { topProjectCount }),
        ...(topPresentingSec !== undefined && { topPresentingSec }),
        ...(topQuestionsSec !== undefined && { topQuestionsSec }),
        ...(defaultPresentingSec !== undefined && { defaultPresentingSec }),
        ...(defaultQuestionsSec !== undefined && { defaultQuestionsSec }),
        staff: {
          create: mcIds.map((hackerId: string) => ({
            hackerId,
            role: "MC" as const,
          })),
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
    console.error("[EVENTS_POST]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}
