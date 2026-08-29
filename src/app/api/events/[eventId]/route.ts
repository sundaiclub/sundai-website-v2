import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import {
  ApplicationTemplateValidationError,
  parseTemplateFieldsJson,
} from '@/lib/applicationTemplates';
import { sanitizeApprovedDetailsJson } from '@/lib/approvedEventDetails';
import {
  canDecideRegistrationsWithContext,
  canManageEventPitchWithContext,
  canManageChapterSettings,
  canViewApprovedOnlyEventDetailsWithContext,
} from '@/lib/eventManagementAuth';
import {
  parseApplicationsOpen,
  parseEventApplicationMode,
  parseEventStaffAssignments,
  parseOptionalDateInput,
  slugifyEventValue,
} from '@/lib/eventRequestParsing';
import {
  getViewerRegistrationState,
  redactPublicEventForViewer,
} from '@/lib/publicEvents';
import { requireEventSettingsManager } from '@/lib/eventManagementApi';
import { HttpsUrlInputError, normalizeOptionalHttpsUrl } from '@/lib/httpsUrls';
import { approveEventStaffRegistrations } from '@/lib/eventStaffRegistrations';
import {
  EventDateTimeInputError,
  parseEventDateTimeInput,
  parseOptionalEventDateTimeInput,
} from '@/lib/eventDateTime';

export async function GET(
  req: Request,
  { params }: { params: { eventId: string } }
) {
  try {
    const searchParams = new URL(req.url).searchParams;
    const managementRead =
      searchParams.get('management') === 'true' ||
      searchParams.get('manageable') === 'true';

    if (managementRead) {
      const access = await requireEventSettingsManager(params.eventId);
      if (access.response) return access.response;

      const event = await prisma.event.findUnique({
        where: { id: params.eventId },
        include: {
          chapter: true,
          image: true,
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

      if (!event) return new NextResponse('Not Found', { status: 404 });

      const canDelete =
        access.hacker!.role === 'SITE_ADMIN' ||
        (await canManageChapterSettings(
          prisma,
          access.hacker!.id,
          event.chapterId
        ));

      return NextResponse.json({
        ...event,
        approvedDetailsJson: sanitizeApprovedDetailsJson(
          event.approvedDetailsJson
        ),
        canDelete,
        canAdminister: canDelete,
      });
    }

    const event = await prisma.event.findFirst({
      where: {
        id: params.eventId,
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
        chapter: {
          status: 'ACTIVE',
          accessMode: 'PUBLIC',
        },
      },
      select: {
        id: true,
        slug: true,
        title: true,
        timezone: true,
        image: { select: { id: true, url: true, alt: true } },
        description: true,
        startTime: true,
        endTime: true,
        meetingUrl: true,
        publicLocation: true,
        status: true,
        visibility: true,
        publicProgramLabel: true,
        programType: true,
        capacity: true,
        applicationMode: true,
        applicationRequired: true,
        applicationsOpen: true,
        applicationsClosedAt: true,
        applicationsCloseReason: true,
        autoPromoteWaitlist: true,
        approvedDetailsJson: true,
        applicationQuestionsJson: true,
        hideChapterDefaultQuestions: true,
        chapterId: true,
        chapter: {
          select: {
            id: true,
            slug: true,
            name: true,
            timezone: true,
            status: true,
            accessMode: true,
          },
        },
        _count: {
          select: {
            registrations: {
              where: {
                status: 'APPROVED',
                cancelledAt: null,
              },
            },
          },
        },
        pitchSessions: {
          select: { phase: true },
          orderBy: { createdAt: 'asc' },
          take: 1,
        },
      },
    });

    if (!event) return new NextResponse('Not Found', { status: 404 });

    const { userId } = auth();
    const viewer = userId
      ? await prisma.hacker.findUnique({
          where: { clerkId: userId },
          select: { id: true, role: true },
        })
      : null;

    const [viewerRegistration, chapterMembership, staff] = viewer
      ? await Promise.all([
          getViewerRegistrationState(event.id, viewer.id),
          prisma.chapterMembership.findFirst({
            where: {
              chapterId: event.chapterId,
              hackerId: viewer.id,
            },
            select: {
              role: true,
              status: true,
            },
          }),
          prisma.eventStaff.findFirst({
            where: {
              eventId: event.id,
              hackerId: viewer.id,
              role: { in: ['MC', 'CO_MC'] },
            },
            select: {
              role: true,
            },
          }),
        ])
      : [null, null, null];

    const viewerCanViewApprovedDetails =
      canViewApprovedOnlyEventDetailsWithContext({
        actor: viewer,
        chapterMembership,
        staff,
        viewerRegistration,
      });
    const viewerCanManageRegistrations = canDecideRegistrationsWithContext({
      actor: viewer,
      chapterMembership,
      staff,
    });
    const viewerCanManagePitch = canManageEventPitchWithContext({
      actor: viewer,
      chapterMembership,
      staff,
    });
    const publicEvent = redactPublicEventForViewer(event, {
      viewerRegistration,
      viewerCanManageRegistrations,
      viewerCanViewApprovedDetails,
      viewerEventStaffRole: staff?.role ?? null,
      viewerIsSignedIn: Boolean(viewer),
    });

    if (!viewerCanViewApprovedDetails) {
      return NextResponse.json({
        ...publicEvent,
        ...(event.meetingUrl ? { meetingUrl: event.meetingUrl } : {}),
      });
    }

    const pitchEvent = await prisma.event.findUnique({
      where: { id: params.eventId },
      select: {
        staff: {
          select: {
            id: true,
            role: true,
            hacker: {
              select: { id: true, name: true },
            },
          },
        },
        pitchSessions: {
          orderBy: { createdAt: 'asc' },
          take: 1,
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

    return NextResponse.json({
      ...publicEvent,
      ...(event.meetingUrl ? { meetingUrl: event.meetingUrl } : {}),
      canManagePitch: viewerCanManagePitch,
      staff: pitchEvent?.staff ?? [],
      pitchSessions: pitchEvent?.pitchSessions ?? [],
    });
  } catch (error) {
    console.error('[EVENT_GET]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { eventId: string } }
) {
  try {
    const access = await requireEventSettingsManager(params.eventId);
    if (access.response) return access.response;
    const user = access.hacker!;

    const existingEvent = await prisma.event.findUnique({
      where: { id: params.eventId },
      select: {
        chapterId: true,
        applicationMode: true,
      },
    });
    if (!existingEvent) return new NextResponse('Not Found', { status: 404 });

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
      slug,
      status,
      visibility,
      programType,
      publicProgramLabel,
      capacity,
      applicationMode,
      applicationRequired,
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
      staff,
      mcIds,
      votingEndTime,
      topProjectCount,
      topPitchSec,
      defaultPitchSec,
    } = body;

    const canAdminister = await canManageChapterSettings(
      prisma,
      user.id,
      existingEvent.chapterId
    );
    const includesAdministrativeChange =
      status !== undefined ||
      visibility !== undefined ||
      applicationsOpen !== undefined ||
      applicationsClosedAt !== undefined ||
      applicationsClosedById !== undefined ||
      applicationsCloseReason !== undefined ||
      staff !== undefined ||
      mcIds !== undefined;
    if (includesAdministrativeChange && !canAdminister) {
      return new NextResponse('Forbidden', { status: 403 });
    }

    const parsedApplicationMode = parseEventApplicationMode(applicationMode);
    if (parsedApplicationMode === null) {
      return NextResponse.json(
        { message: 'applicationMode must be REQUIRES_APPROVAL or OPEN_RSVP' },
        { status: 400 }
      );
    }

    if (
      applicationRequired !== undefined &&
      typeof applicationRequired !== 'boolean'
    ) {
      return NextResponse.json(
        { message: 'applicationRequired must be a boolean' },
        { status: 400 }
      );
    }

    const nextApplicationMode =
      parsedApplicationMode ?? existingEvent.applicationMode;
    const nextApplicationRequired =
      nextApplicationMode === 'REQUIRES_APPROVAL' ? true : applicationRequired;

    const parsedApplicationsOpen = parseApplicationsOpen(applicationsOpen);
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

    const parsedStartTime =
      startTime === undefined
        ? undefined
        : parseEventDateTimeInput(startTime, timezone, 'startTime');
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
    if (parsedStartTime && parsedEndTime && parsedEndTime <= parsedStartTime) {
      throw new EventDateTimeInputError('endTime must be after startTime');
    }
    const normalizedMeetingUrl =
      meetingUrl === undefined
        ? undefined
        : normalizeOptionalHttpsUrl(meetingUrl, 'Meeting URL');
    const normalizedVirtualUrl =
      virtualUrl === undefined
        ? undefined
        : normalizeOptionalHttpsUrl(virtualUrl, 'Virtual URL');

    if (applicationQuestionsJson !== undefined) {
      parseTemplateFieldsJson(
        applicationQuestionsJson,
        'applicationQuestionsJson',
        {
          allowSiteRequiredFieldIds: false,
        }
      );
    }

    const parsedStaff =
      staff !== undefined ? parseEventStaffAssignments(staff) : undefined;
    if (parsedStaff === null) {
      return NextResponse.json(
        { message: 'staff must contain MC or CO_MC assignments' },
        { status: 400 }
      );
    }

    const timingConfigChanged =
      votingEndTime !== undefined ||
      topProjectCount !== undefined ||
      topPitchSec !== undefined ||
      defaultPitchSec !== undefined;

    const eventUpdate = prisma.event.update({
      where: { id: params.eventId },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description: description || null }),
        ...(startTime !== undefined && { startTime: parsedStartTime }),
        ...(timezone !== undefined && { timezone }),
        ...(endTime !== undefined && {
          endTime: parsedEndTime,
        }),
        ...(meetingUrl !== undefined && { meetingUrl: normalizedMeetingUrl }),
        ...(location !== undefined && { location: location || null }),
        ...(venueName !== undefined && { venueName: venueName || null }),
        ...(publicLocation !== undefined && {
          publicLocation: publicLocation || null,
        }),
        ...(address !== undefined && { address: address || null }),
        ...(virtualUrl !== undefined && { virtualUrl: normalizedVirtualUrl }),
        ...(slug !== undefined && {
          slug: slugifyEventValue(slug || title || params.eventId),
        }),
        ...(status !== undefined && { status }),
        ...(visibility !== undefined && { visibility }),
        ...(programType !== undefined && { programType: programType || null }),
        ...(publicProgramLabel !== undefined && {
          publicProgramLabel: publicProgramLabel || null,
        }),
        ...(capacity !== undefined && {
          capacity: capacity === null ? null : Number(capacity),
        }),
        ...(parsedApplicationMode !== undefined && {
          applicationMode: parsedApplicationMode,
        }),
        ...(nextApplicationRequired !== undefined && {
          applicationRequired: nextApplicationRequired,
        }),
        ...(autoPromoteWaitlist !== undefined && {
          autoPromoteWaitlist: Boolean(autoPromoteWaitlist),
        }),
        ...(approvedDetailsJson !== undefined && {
          approvedDetailsJson: sanitizeApprovedDetailsJson(approvedDetailsJson),
        }),
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
        ...(parsedApplicationsOpen !== undefined && {
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
        }),
        ...(parsedApplicationsOpen === undefined &&
          applicationsClosedAt !== undefined && {
            applicationsClosedAt: parsedApplicationsClosedAt.date,
          }),
        ...(parsedApplicationsOpen === undefined &&
          applicationsClosedById !== undefined && {
            applicationsClosedById: applicationsClosedById || null,
          }),
        ...(parsedApplicationsOpen === undefined &&
          applicationsCloseReason !== undefined && {
            applicationsCloseReason: applicationsCloseReason || null,
          }),
        ...(checkInOpensAt !== undefined && {
          checkInOpensAt: parsedCheckInOpensAt,
        }),
        ...(checkInClosesAt !== undefined && {
          checkInClosesAt: parsedCheckInClosesAt,
        }),
      },
    });

    const pitchSession = timingConfigChanged
      ? await prisma.pitchSession.findFirst({
          where: { eventId: params.eventId },
        })
      : null;

    if (timingConfigChanged && pitchSession) {
      const nextTopPitchSec = topPitchSec ?? pitchSession.topPitchSec;
      const nextDefaultPitchSec =
        defaultPitchSec ?? pitchSession.defaultPitchSec;

      const pitchSessionUpdate = prisma.pitchSession.update({
        where: { id: pitchSession.id },
        data: {
          ...(votingEndTime !== undefined && {
            votingEndTime: parsedVotingEndTime,
          }),
          ...(topProjectCount !== undefined && { topProjectCount }),
          ...(topPitchSec !== undefined && { topPitchSec }),
          ...(defaultPitchSec !== undefined && { defaultPitchSec }),
        },
      });

      if (pitchSession.phase === 'PITCHING') {
        await prisma.$transaction([
          eventUpdate,
          pitchSessionUpdate,
          prisma.pitchProject.updateMany({
            where: {
              pitchSessionId: pitchSession.id,
              isTopProject: true,
              status: { in: ['CURRENT', 'APPROVED'] },
            },
            data: {
              allottedSec: nextTopPitchSec,
            },
          }),
          prisma.pitchProject.updateMany({
            where: {
              pitchSessionId: pitchSession.id,
              isTopProject: false,
              status: { in: ['CURRENT', 'APPROVED'] },
            },
            data: {
              allottedSec: nextDefaultPitchSec,
            },
          }),
        ]);
      } else {
        await prisma.$transaction([eventUpdate, pitchSessionUpdate]);
      }
    } else {
      await eventUpdate;
    }

    if (staff !== undefined) {
      await prisma.eventStaff.deleteMany({
        where: { eventId: params.eventId },
      });
      if (parsedStaff && parsedStaff.length > 0) {
        await prisma.eventStaff.createMany({
          data: parsedStaff.map(assignment => ({
            eventId: params.eventId,
            hackerId: assignment.hackerId,
            role: assignment.role,
          })),
        });
        await approveEventStaffRegistrations(prisma, {
          eventId: params.eventId,
          hackerIds: parsedStaff.map(assignment => assignment.hackerId),
          actorId: user.id,
        });
      }
    } else if (mcIds !== undefined) {
      await prisma.eventStaff.deleteMany({
        where: { eventId: params.eventId, role: 'MC' },
      });
      if (mcIds.length > 0) {
        await prisma.eventStaff.createMany({
          data: mcIds.map((hackerId: string) => ({
            eventId: params.eventId,
            hackerId,
            role: 'MC' as const,
          })),
        });
        await approveEventStaffRegistrations(prisma, {
          eventId: params.eventId,
          hackerIds: mcIds,
          actorId: user.id,
        });
      }
    }

    const event = await prisma.event.findUnique({
      where: { id: params.eventId },
      include: {
        chapter: true,
        image: true,
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

    return NextResponse.json(event);
  } catch (error) {
    if (error instanceof HttpsUrlInputError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    if (error instanceof EventDateTimeInputError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }
    if (error instanceof ApplicationTemplateValidationError) {
      return NextResponse.json(
        { message: error.message, issues: error.issues },
        { status: 400 }
      );
    }
    console.error('[EVENT_PATCH]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { eventId: string } }
) {
  try {
    const { userId } = auth();
    if (!userId) return new NextResponse('Unauthorized', { status: 401 });

    const user = await prisma.hacker.findUnique({
      where: { clerkId: userId },
      select: { id: true, role: true },
    });
    if (!user) return new NextResponse('Unauthorized', { status: 401 });

    const event = await prisma.event.findUnique({
      where: { id: params.eventId },
      select: { id: true, chapterId: true, status: true },
    });
    if (!event) return new NextResponse('Not Found', { status: 404 });

    const canDelete =
      user.role === 'SITE_ADMIN' ||
      (await canManageChapterSettings(prisma, user.id, event.chapterId));
    if (!canDelete) return new NextResponse('Forbidden', { status: 403 });

    if (event.status !== 'DRAFT') {
      return NextResponse.json(
        { message: 'Only draft events can be deleted.' },
        { status: 409 }
      );
    }

    const pitchSessions = await prisma.pitchSession.findMany({
      where: { eventId: event.id },
      select: { id: true },
    });
    const pitchSessionIds = pitchSessions.map(session => session.id);
    const pitchProjects = pitchSessionIds.length
      ? await prisma.pitchProject.findMany({
          where: { pitchSessionId: { in: pitchSessionIds } },
          select: { id: true },
        })
      : [];
    const pitchProjectIds = pitchProjects.map(project => project.id);

    await prisma.$transaction([
      prisma.pitchProjectVote.deleteMany({
        where: { pitchProjectId: { in: pitchProjectIds } },
      }),
      prisma.pitchProject.deleteMany({
        where: { pitchSessionId: { in: pitchSessionIds } },
      }),
      prisma.pitchSession.deleteMany({ where: { eventId: event.id } }),
      prisma.eventProject.deleteMany({ where: { eventId: event.id } }),
      prisma.eventRegistrationAudit.deleteMany({
        where: { eventId: event.id },
      }),
      prisma.eventRegistration.deleteMany({ where: { eventId: event.id } }),
      prisma.eventStaff.deleteMany({ where: { eventId: event.id } }),
      prisma.event.delete({ where: { id: event.id } }),
    ]);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('[EVENT_DELETE]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
