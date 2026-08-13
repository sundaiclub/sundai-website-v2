import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import { canManageChapterSettings } from '@/lib/eventManagementAuth';
import {
  ApplicationTemplateValidationError,
  parseTemplateFieldsJson,
} from '@/lib/applicationTemplates';
import { sanitizeApprovedDetailsJson } from '@/lib/approvedEventDetails';
import {
  parseApplicationsOpen,
  parseEventApplicationMode,
  parseEventStaffAssignments,
  parseOptionalDateInput,
  slugifyEventValue,
} from '@/lib/eventRequestParsing';
import { DEFAULT_EVENT_MESSAGES } from '@/lib/eventMessageDefaults';
import { listPublicEvents } from '@/lib/publicEvents';
import {
  EventDateTimeInputError,
  parseEventDateTimeInput,
  parseOptionalEventDateTimeInput,
} from '@/lib/eventDateTime';

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
        period:
          searchParams.get('period') === 'previous' ? 'previous' : 'upcoming',
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
      timezone,
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
      audienceCanReorder = true,
      votingEndTime,
      topProjectCount,
      topPitchSec,
      defaultPitchSec,
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

    const parsedApplicationMode = parseEventApplicationMode(
      applicationMode,
      'REQUIRES_APPROVAL'
    );
    if (!parsedApplicationMode) {
      return NextResponse.json(
        { message: 'applicationMode must be REQUIRES_APPROVAL or OPEN_RSVP' },
        { status: 400 }
      );
    }

    const parsedApplicationsOpen = parseApplicationsOpen(
      applicationsOpen,
      true
    );
    if (parsedApplicationsOpen === null) {
      return NextResponse.json(
        { message: 'applicationsOpen must be a boolean' },
        { status: 400 }
      );
    }

    const parsedApplicationsClosedAt = parseOptionalDateInput(
      applicationsClosedAt,
      'applicationsClosedAt'
    );
    if ('error' in parsedApplicationsClosedAt) {
      return NextResponse.json(
        { message: parsedApplicationsClosedAt.error },
        { status: 400 }
      );
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

    const parsedStaff = parseEventStaffAssignments(staff);
    if (!parsedStaff) {
      return NextResponse.json(
        { message: 'staff must contain MC or CO_MC assignments' },
        { status: 400 }
      );
    }

    const parsedStartTime = parseEventDateTimeInput(
      startTime,
      timezone,
      'startTime'
    );
    const parsedEndTime = parseOptionalEventDateTimeInput(
      endTime,
      timezone,
      'endTime'
    );
    const parsedCheckInOpensAt = parseOptionalEventDateTimeInput(
      checkInOpensAt,
      timezone,
      'checkInOpensAt'
    );
    const parsedCheckInClosesAt = parseOptionalEventDateTimeInput(
      checkInClosesAt,
      timezone,
      'checkInClosesAt'
    );
    const parsedVotingEndTime = parseOptionalEventDateTimeInput(
      votingEndTime,
      timezone,
      'votingEndTime'
    );
    if (parsedEndTime && parsedEndTime <= parsedStartTime) {
      throw new EventDateTimeInputError('endTime must be after startTime');
    }

    const event = await prisma.event.create({
      data: {
        title,
        description: description || null,
        startTime: parsedStartTime,
        timezone,
        ...(endTime !== undefined && {
          endTime: parsedEndTime,
        }),
        chapterId,
        slug: slugifyEventValue(slug || title),
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
        ...(approvedDetailsJson !== undefined && {
          approvedDetailsJson: sanitizeApprovedDetailsJson(approvedDetailsJson),
        }),
        ...(applicationQuestionsJson !== undefined && {
          applicationQuestionsJson,
        }),
        ...(hideChapterDefaultQuestions !== undefined && {
          hideChapterDefaultQuestions: Boolean(hideChapterDefaultQuestions),
        }),
        confirmationMessage:
          confirmationMessage === undefined
            ? DEFAULT_EVENT_MESSAGES.confirmation
            : confirmationMessage || null,
        waitlistMessage:
          waitlistMessage === undefined
            ? DEFAULT_EVENT_MESSAGES.waitlist
            : waitlistMessage || null,
        declineMessage:
          declineMessage === undefined
            ? DEFAULT_EVENT_MESSAGES.decline
            : declineMessage || null,
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
          checkInOpensAt: parsedCheckInOpensAt,
        }),
        ...(checkInClosesAt !== undefined && {
          checkInClosesAt: parsedCheckInClosesAt,
        }),
        staff: {
          create:
            parsedStaff.length > 0
              ? parsedStaff
              : mcIds.map((hackerId: string) => ({
                  hackerId,
                  role: 'MC' as const,
                })),
        },
        pitchSessions: {
          create: {
            chapterId,
            title,
            description: description || null,
            startTime: parsedStartTime,
            meetingUrl: meetingUrl || null,
            location: location || null,
            createdById: user.id,
            audienceCanReorder,
            votingEndTime:
              parsedVotingEndTime ??
              new Date(parsedStartTime.getTime() + 15 * 60 * 1000),
            ...(topProjectCount !== undefined && { topProjectCount }),
            ...(topPitchSec !== undefined && { topPitchSec }),
            ...(defaultPitchSec !== undefined && { defaultPitchSec }),
          },
        },
      },
      include: {
        pitchSessions: true,
        staff: true,
      },
    });

    return NextResponse.json(event);
  } catch (error) {
    if (error instanceof EventDateTimeInputError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
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
