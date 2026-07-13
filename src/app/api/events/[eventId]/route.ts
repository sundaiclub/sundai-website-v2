import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import {
  ApplicationTemplateValidationError,
  parseTemplateFieldsJson,
} from '@/lib/applicationTemplates';
import {
  canDecideRegistrationsWithContext,
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

      return NextResponse.json({ ...event, canDelete });
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
        description: true,
        startTime: true,
        endTime: true,
        publicLocation: true,
        status: true,
        visibility: true,
        publicProgramLabel: true,
        programType: true,
        capacity: true,
        applicationMode: true,
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

    return NextResponse.json(
      redactPublicEventForViewer(event, {
        viewerRegistration,
        viewerCanManageRegistrations,
        viewerCanViewApprovedDetails,
        viewerIsSignedIn: Boolean(viewer),
      })
    );
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
      },
    });
    if (!existingEvent) return new NextResponse('Not Found', { status: 404 });

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
      topPresentingSec,
      topQuestionsSec,
      defaultPresentingSec,
      defaultQuestionsSec,
    } = body;

    const parsedApplicationMode = parseEventApplicationMode(applicationMode);
    if (parsedApplicationMode === null) {
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
        ...(endTime !== undefined && {
          endTime: endTime ? new Date(endTime) : null,
        }),
        ...(meetingUrl !== undefined && { meetingUrl: meetingUrl || null }),
        ...(location !== undefined && { location: location || null }),
        ...(venueName !== undefined && { venueName: venueName || null }),
        ...(publicLocation !== undefined && {
          publicLocation: publicLocation || null,
        }),
        ...(address !== undefined && { address: address || null }),
        ...(virtualUrl !== undefined && { virtualUrl: virtualUrl || null }),
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
        ...(autoPromoteWaitlist !== undefined && {
          autoPromoteWaitlist: Boolean(autoPromoteWaitlist),
        }),
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
          checkInOpensAt: checkInOpensAt ? new Date(checkInOpensAt) : null,
        }),
        ...(checkInClosesAt !== undefined && {
          checkInClosesAt: checkInClosesAt ? new Date(checkInClosesAt) : null,
        }),
      },
    });

    const pitchSession = timingConfigChanged
      ? await prisma.pitchSession.findFirst({
          where: { eventId: params.eventId },
        })
      : null;

    if (timingConfigChanged && pitchSession) {
      const nextTopPresentingSec =
        topPresentingSec ?? pitchSession.topPresentingSec;
      const nextTopQuestionsSec =
        topQuestionsSec ?? pitchSession.topQuestionsSec;
      const nextDefaultPresentingSec =
        defaultPresentingSec ?? pitchSession.defaultPresentingSec;
      const nextDefaultQuestionsSec =
        defaultQuestionsSec ?? pitchSession.defaultQuestionsSec;

      const pitchSessionUpdate = prisma.pitchSession.update({
        where: { id: pitchSession.id },
        data: {
          ...(votingEndTime !== undefined && {
            votingEndTime: votingEndTime ? new Date(votingEndTime) : null,
          }),
          ...(topProjectCount !== undefined && { topProjectCount }),
          ...(topPresentingSec !== undefined && { topPresentingSec }),
          ...(topQuestionsSec !== undefined && { topQuestionsSec }),
          ...(defaultPresentingSec !== undefined && { defaultPresentingSec }),
          ...(defaultQuestionsSec !== undefined && { defaultQuestionsSec }),
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
              allottedPresentingSec: nextTopPresentingSec,
              allottedQuestionsSec: nextTopQuestionsSec,
            },
          }),
          prisma.pitchProject.updateMany({
            where: {
              pitchSessionId: pitchSession.id,
              isTopProject: false,
              status: { in: ['CURRENT', 'APPROVED'] },
            },
            data: {
              allottedPresentingSec: nextDefaultPresentingSec,
              allottedQuestionsSec: nextDefaultQuestionsSec,
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
      }
    }

    const event = await prisma.event.findUnique({
      where: { id: params.eventId },
      include: {
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
