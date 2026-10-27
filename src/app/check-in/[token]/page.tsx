import { auth } from '@clerk/nextjs/server';
import { notFound, redirect } from 'next/navigation';
import {
  ManagementAlert,
  ManagementBadge,
  ManagementLinkButton,
  ManagementPage,
  ManagementSection,
} from '../../components/ManagementSurface';
import { RegistrationAnswers } from '../../components/RegistrationReviewQueue';
import prisma from '@/lib/prisma';
import {
  canAccessEventWorkspaceWithContext,
  getEventPermissionContext,
} from '@/lib/eventManagementAuth';
import {
  CHECK_IN_ORGANIZERS_ONLY_NOTICE,
  hasCheckInWindowEnded,
  loadRegistrationByCheckInToken,
} from '@/lib/eventCheckIn';
import type {
  JsonObject,
  TemplateFieldDefinition,
} from '@/types/event-management';
import CheckInButton from './CheckInButton';

export const dynamic = 'force-dynamic';

function formatTime(value: Date, timezone: string) {
  return value.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: timezone,
  });
}

export default async function CheckInPage(
  props: {
    params: Promise<{ token: string }>;
  }
) {
  const params = await props.params;
  const registration = await loadRegistrationByCheckInToken(params.token);
  if (!registration) notFound();

  const { event, hacker } = registration;
  const eventPath = `/events/${encodeURIComponent(event.chapter.slug)}/${encodeURIComponent(event.slug)}`;

  const { userId } = await auth();
  const viewer = userId
    ? await prisma.hacker.findUnique({
        where: { clerkId: userId },
        select: { id: true },
      })
    : null;
  const permissionContext = viewer
    ? await getEventPermissionContext(prisma, viewer.id, event.id)
    : null;
  if (
    !permissionContext ||
    !canAccessEventWorkspaceWithContext(permissionContext)
  ) {
    redirect(`${eventPath}?notice=${CHECK_IN_ORGANIZERS_ONLY_NOTICE}`);
  }

  const isApproved =
    registration.status === 'APPROVED' && !registration.cancelledAt;
  const eventEnded = hasCheckInWindowEnded(event);

  let checkInPanel;
  if (!event.trackAttendance) {
    checkInPanel = (
      <ManagementAlert tone="warning">
        Attendance tracking is turned off for this event.
      </ManagementAlert>
    );
  } else if (eventEnded) {
    checkInPanel = (
      <ManagementAlert tone="warning">
        This event has ended. Check-in is closed.
      </ManagementAlert>
    );
  } else if (registration.checkedInAt) {
    checkInPanel = (
      <ManagementAlert tone="success">
        Already checked in at{' '}
        {formatTime(registration.checkedInAt, event.timezone)}
        {registration.checkedInBy ? ` by ${registration.checkedInBy.name}` : ''}
        .
      </ManagementAlert>
    );
  } else if (!isApproved) {
    checkInPanel = (
      <ManagementAlert tone="danger">
        This registration is{' '}
        {registration.cancelledAt
          ? 'cancelled'
          : registration.status.toLowerCase()}
        . Only approved attendees can be checked in.
      </ManagementAlert>
    );
  } else {
    checkInPanel = (
      <CheckInButton
        attendeeName={hacker.name}
        eventId={event.id}
        registrationId={registration.id}
        timezone={event.timezone}
      />
    );
  }

  return (
    <ManagementPage maxWidth="max-w-3xl">
      <div className="mb-4 flex flex-wrap gap-2">
        <ManagementLinkButton
          href={`/organizer/events/${event.id}/check-in`}
          variant="ghost"
        >
          <span aria-hidden="true">&larr;</span>
          Check-in list
        </ManagementLinkButton>
      </div>
      <div className="space-y-5">
        <ManagementSection
          title={hacker.name}
          description={`${event.title} · ${event.chapter.name}`}
          size="large"
        >
          <div className="mb-5 flex flex-wrap items-center gap-3">
            {hacker.avatar?.url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt=""
                className="h-14 w-14 rounded-full object-cover"
                src={hacker.avatar.url}
              />
            )}
            <div className="min-w-0 text-sm">
              {hacker.username && <p>@{hacker.username}</p>}
              {hacker.email && <p className="break-all">{hacker.email}</p>}
            </div>
            <ManagementBadge
              tone={
                isApproved
                  ? registration.checkedInAt
                    ? 'success'
                    : 'default'
                  : 'danger'
              }
            >
              {registration.cancelledAt ? 'CANCELLED' : registration.status}
            </ManagementBadge>
          </div>
          {checkInPanel}
        </ManagementSection>

        <ManagementSection title="Application">
          <RegistrationAnswers
            answersJson={registration.answersJson as JsonObject | null}
            templateSnapshotJson={
              registration.templateSnapshotJson as
                | TemplateFieldDefinition[]
                | null
            }
          />
        </ManagementSection>
      </div>
    </ManagementPage>
  );
}
