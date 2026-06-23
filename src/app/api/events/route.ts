import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import { canManageChapterSettings } from '@/lib/eventManagementAuth';
import {
  ApplicationTemplateValidationError,
  parseTemplateFieldsJson,
} from '@/lib/applicationTemplates';
import { listPublicEvents } from '@/lib/publicEvents';

const PHASE_2_APPLICATION_MODES = ['REQUIRES_APPROVAL', 'OPEN_RSVP'] as const;
type Phase2ApplicationMode = (typeof PHASE_2_APPLICATION_MODES)[number];

function slugify(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'event'
  );
}

function parseApplicationMode(value: unknown): Phase2ApplicationMode | null {
  if (value === undefined) return 'REQUIRES_APPROVAL';
  if (
    typeof value === 'string' &&
    PHASE_2_APPLICATION_MODES.includes(value as Phase2ApplicationMode)
  ) {
    return value as Phase2ApplicationMode;
  }

  return null;
}

function parseApplicationsOpen(value: unknown): boolean | null {
  if (value === undefined) return true;
  return typeof value === 'boolean' ? value : null;
}

function parseOptionalDate(value: unknown, field: string) {
  if (value === undefined || value === null || value === '')
    return { date: null };
  if (typeof value !== 'string' && !(value instanceof Date)) {
    return {
      error: NextResponse.json(
        { message: `${field} must be a valid date` },
        { status: 400 }
      ),
    };
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return {
      error: NextResponse.json(
        { message: `${field} must be a valid date` },
        { status: 400 }
      ),
    };
  }

  return { date };
}

export async function GET(req: Request) {
  try {
    const searchParams = new URL(req.url).searchParams;
    const organizerOnly =
      searchParams.get('organizer') === 'true' ||
      searchParams.get('manageable') === 'true';
    const { userId } = auth();

    if (!organizerOnly) {
      const viewer = userId
        ? await prisma.hacker.findUnique({
            where: { clerkId: userId },
            select: { id: true },
          })
        : null;
      const events = await listPublicEvents({
        chapterSlug: searchParams.get('chapterSlug'),
        viewer: viewer ? { hackerId: viewer.id } : null,
      });

      return NextResponse.json(events);
    }

    if (organizerOnly && !userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const user = userId
      ? await prisma.hacker.findUnique({
          where: { clerkId: userId },
          select: { id: true, role: true },
        })
      : null;
    if (organizerOnly && !user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const chapterAdminMemberships =
      user && user.role !== 'SITE_ADMIN'
        ? await prisma.chapterMembership.findMany({
            where: {
              hackerId: user.id,
              role: 'ADMIN',
              status: 'ACTIVE',
            },
            select: { chapterId: true },
          })
        : [];
    const manageableChapterIds = chapterAdminMemberships.map(
      membership => membership.chapterId
    );
    if (
      organizerOnly &&
      user?.role !== 'SITE_ADMIN' &&
      manageableChapterIds.length === 0
    ) {
      return new NextResponse('Forbidden', { status: 403 });
    }

    const events = await prisma.event.findMany({
      where: organizerOnly
        ? user?.role === 'SITE_ADMIN'
          ? undefined
          : { chapterId: { in: manageableChapterIds } }
        : user?.role === 'SITE_ADMIN' || manageableChapterIds.length === 0
          ? undefined
          : { chapterId: { in: manageableChapterIds } },
      orderBy: { startTime: 'desc' },
      include: {
        chapter: { select: { id: true, name: true, slug: true } },
        staff: { include: { hacker: { include: { avatar: true } } } },
        pitchSessions: {
          include: {
            projects: {
              orderBy: { position: 'asc' },
              include: {
                pitchVotes: {
                  select: { hackerId: true, value: true, createdAt: true },
                },
                project: {
                  include: {
                    thumbnail: true,
                    launchLead: { include: { avatar: true } },
                    participants: {
                      include: { hacker: { include: { avatar: true } } },
                    },
                    techTags: true,
                    domainTags: true,
                    likes: { select: { hackerId: true, createdAt: true } },
                  },
                },
              },
            },
          },
        },
      },
    });

    return NextResponse.json(events);
  } catch (error) {
    console.error('[EVENTS_GET]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { userId } = auth();
    if (!userId) return new NextResponse('Unauthorized', { status: 401 });

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
      chapterId = 'boston',
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
      confirmationMessage,
      waitlistMessage,
      declineMessage,
      applicationsOpen,
      applicationsClosedAt,
      applicationsClosedById,
      applicationsCloseReason,
      checkInOpensAt,
      checkInClosesAt,
      staff = [],
      mcIds = [],
      createPitchSession = false,
      audienceCanReorder = true,
      votingEndTime,
      topProjectCount,
      topPresentingSec,
      topQuestionsSec,
      defaultPresentingSec,
      defaultQuestionsSec,
    } = body || {};
    const canCreate =
      user?.role === 'SITE_ADMIN' ||
      (user && (await canManageChapterSettings(prisma, user.id, chapterId)));
    if (!canCreate) return new NextResponse('Forbidden', { status: 403 });

    if (!title || !startTime) {
      return NextResponse.json(
        { message: 'title and startTime are required' },
        { status: 400 }
      );
    }

    const parsedApplicationMode = parseApplicationMode(applicationMode);
    if (!parsedApplicationMode) {
      return NextResponse.json(
        { message: 'applicationMode must be REQUIRES_APPROVAL or OPEN_RSVP' },
        { status: 400 }
      );
    }

    const parsedApplicationsOpen = parseApplicationsOpen(applicationsOpen);
    if (parsedApplicationsOpen === null) {
      return NextResponse.json(
        { message: 'applicationsOpen must be a boolean' },
        { status: 400 }
      );
    }

    const parsedApplicationsClosedAt = parseOptionalDate(
      applicationsClosedAt,
      'applicationsClosedAt'
    );
    if ('error' in parsedApplicationsClosedAt) {
      return parsedApplicationsClosedAt.error;
    }

    if (applicationQuestionsJson !== undefined) {
      parseTemplateFieldsJson(
        applicationQuestionsJson,
        'applicationQuestionsJson',
        {
          allowSiteRequiredFieldIds: false,
        }
      );
    }

    const event = await prisma.event.create({
      data: {
        title,
        description: description || null,
        startTime: new Date(startTime),
        ...(endTime !== undefined && {
          endTime: endTime ? new Date(endTime) : null,
        }),
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
        ...(publicProgramLabel !== undefined && {
          publicProgramLabel: publicProgramLabel || null,
        }),
        ...(capacity !== undefined && {
          capacity: capacity === null ? null : Number(capacity),
        }),
        applicationMode: parsedApplicationMode,
        autoPromoteWaitlist: Boolean(autoPromoteWaitlist),
        ...(approvedDetailsJson !== undefined && { approvedDetailsJson }),
        ...(applicationQuestionsJson !== undefined && {
          applicationQuestionsJson,
        }),
        ...(hideChapterDefaultQuestions !== undefined && {
          hideChapterDefaultQuestions: Boolean(hideChapterDefaultQuestions),
        }),
        ...(confirmationMessage !== undefined && {
          confirmationMessage: confirmationMessage || null,
        }),
        ...(waitlistMessage !== undefined && {
          waitlistMessage: waitlistMessage || null,
        }),
        ...(declineMessage !== undefined && {
          declineMessage: declineMessage || null,
        }),
        applicationsOpen: parsedApplicationsOpen,
        applicationsClosedAt: parsedApplicationsOpen
          ? null
          : (parsedApplicationsClosedAt.date ?? new Date()),
        applicationsClosedById: parsedApplicationsOpen
          ? null
          : applicationsClosedById || user.id,
        applicationsCloseReason: parsedApplicationsOpen
          ? null
          : applicationsCloseReason || null,
        ...(checkInOpensAt !== undefined && {
          checkInOpensAt: checkInOpensAt ? new Date(checkInOpensAt) : null,
        }),
        ...(checkInClosesAt !== undefined && {
          checkInClosesAt: checkInClosesAt ? new Date(checkInClosesAt) : null,
        }),
        staff: {
          create:
            Array.isArray(staff) && staff.length > 0
              ? staff.map((assignment: { hackerId: string; role: string }) => ({
                  hackerId: assignment.hackerId,
                  role: assignment.role === 'CO_MC' ? 'CO_MC' : 'MC',
                }))
              : mcIds.map((hackerId: string) => ({
                  hackerId,
                  role: 'MC' as const,
                })),
        },
        ...(createPitchSession && {
          pitchSessions: {
            create: {
              chapterId,
              title,
              description: description || null,
              startTime: new Date(startTime),
              meetingUrl: meetingUrl || null,
              location: location || null,
              createdById: user.id,
              legacyBackfill: false,
              audienceCanReorder,
              votingEndTime: votingEndTime
                ? new Date(votingEndTime)
                : new Date(new Date(startTime).getTime() + 15 * 60 * 1000),
              ...(topProjectCount !== undefined && { topProjectCount }),
              ...(topPresentingSec !== undefined && { topPresentingSec }),
              ...(topQuestionsSec !== undefined && { topQuestionsSec }),
              ...(defaultPresentingSec !== undefined && {
                defaultPresentingSec,
              }),
              ...(defaultQuestionsSec !== undefined && { defaultQuestionsSec }),
            },
          },
        }),
      },
      include: {
        pitchSessions: true,
        staff: true,
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
    console.error('[EVENTS_POST]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
