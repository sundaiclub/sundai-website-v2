'use client';

import Link from 'next/link';
import { ManagementBadge, useManagementClasses } from './ManagementSurface';
import type {
  PublicEventCard as PublicEventCardData,
  PublicEventStatus,
  RegistrationStatus,
} from '@/types/event-management';

type BadgeTone = 'default' | 'danger' | 'success' | 'warning';

type PublicEventStatusDisplay = {
  label: string;
  tone: BadgeTone;
};

const publicStatusDisplay: Record<PublicEventStatus, PublicEventStatusDisplay> =
  {
    OPEN: { label: 'Open', tone: 'success' },
    CLOSED: { label: 'Closed', tone: 'default' },
    FULL: { label: 'Full', tone: 'warning' },
    WAITLIST_AVAILABLE: { label: 'Waitlist available', tone: 'warning' },
    ENDED: { label: 'Ended', tone: 'default' },
  };

const registrationStatusDisplay: Record<
  RegistrationStatus,
  PublicEventStatusDisplay
> = {
  PENDING: { label: 'Application pending', tone: 'warning' },
  APPROVED: { label: 'Registered', tone: 'success' },
  WAITLISTED: { label: 'Waitlisted', tone: 'warning' },
  DECLINED: { label: 'Application declined', tone: 'danger' },
  BLOCKED: { label: 'Registration unavailable', tone: 'danger' },
  CANCELLED: { label: 'Registration cancelled', tone: 'default' },
};

function getPublicEventStatusDisplay(
  status: PublicEventStatus
): PublicEventStatusDisplay {
  return publicStatusDisplay[status];
}

function getViewerRegistrationStatusDisplay(
  status: RegistrationStatus
): PublicEventStatusDisplay {
  return registrationStatusDisplay[status];
}

export function PublicEventStatusBadge({
  status,
}: {
  status: PublicEventStatus;
}) {
  const display = getPublicEventStatusDisplay(status);

  return <ManagementBadge tone={display.tone}>{display.label}</ManagementBadge>;
}

export function ViewerRegistrationStatusBadge({
  status,
}: {
  status: RegistrationStatus;
}) {
  const display = getViewerRegistrationStatusDisplay(status);

  return <ManagementBadge tone={display.tone}>{display.label}</ManagementBadge>;
}

function formatEventDateTime(
  startTime: PublicEventCardData['startTime'],
  endTime: PublicEventCardData['endTime'],
  timezone?: string | null
) {
  const start = new Date(startTime);
  const end = endTime ? new Date(endTime) : null;

  if (Number.isNaN(start.getTime())) {
    return 'Date to be announced';
  }

  const dateFormatter = new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...(timezone ? { timeZone: timezone } : {}),
  });
  const timeFormatter = new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
    ...(timezone ? { timeZone: timezone } : {}),
  });

  const startDate = dateFormatter.format(start);
  const startTimeLabel = timeFormatter.format(start);

  if (!end || Number.isNaN(end.getTime())) {
    return `${startDate} at ${startTimeLabel}`;
  }

  const endDate = dateFormatter.format(end);
  const endTimeLabel = timeFormatter.format(end);

  if (startDate === endDate) {
    return `${startDate}, ${startTimeLabel} - ${endTimeLabel}`;
  }

  return `${startDate}, ${startTimeLabel} - ${endDate}, ${endTimeLabel}`;
}

function PublicEventCard({ event }: { event: PublicEventCardData }) {
  const classes = useManagementClasses();
  const href = `/events/${event.chapterSlug}/${event.slug}`;
  const timeLabel = formatEventDateTime(
    event.startTime,
    event.endTime,
    event.chapter?.timezone
  );

  return (
    <article className={`${classes.panel} p-4 sm:p-5`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className={`text-xs font-bold uppercase ${classes.mutedText}`}>
            {event.chapterName}
          </p>
          <h2 className="mt-2 text-xl font-bold leading-tight">
            <Link
              className="break-words underline-offset-4 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-current focus-visible:ring-offset-2"
              href={href}
            >
              {event.title}
            </Link>
          </h2>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <PublicEventStatusBadge status={event.publicStatus} />
          {event.viewerRegistrationStatus && (
            <ViewerRegistrationStatusBadge
              status={event.viewerRegistrationStatus}
            />
          )}
        </div>
      </div>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className={`font-semibold ${classes.mutedText}`}>When</dt>
          <dd className="mt-1">{timeLabel}</dd>
        </div>
        <div>
          <dt className={`font-semibold ${classes.mutedText}`}>Where</dt>
          <dd className="mt-1">{event.publicLocation || 'Location TBA'}</dd>
        </div>
      </dl>
    </article>
  );
}

export default PublicEventCard;
