'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { ManagementBadge, useManagementClasses } from './ManagementSurface';
import type { EventStatus, EventVisibility } from '@/types/event-management';

type EventSummaryCardData = {
  id: string;
  title: string;
  image?: {
    url: string;
    alt?: string | null;
  } | null;
  publicLocation?: string | null;
  startTime?: Date | string;
  timezone?: string;
  chapter?: { timezone?: string };
  status?: EventStatus;
  visibility?: EventVisibility;
};

export default function EventSummaryCard({
  event,
  href,
  onClick,
  dateLabel,
  badges,
  className = '',
  eyebrow,
  showState = false,
  showEdit = false,
  timezone,
}: {
  event: EventSummaryCardData;
  dateLabel?: string;
  badges?: ReactNode;
  className?: string;
  eyebrow?: ReactNode;
  showState?: boolean;
  showEdit?: boolean;
  timezone?: string;
} & (
  | { href: string; onClick?: never }
  | { href?: never; onClick: () => void }
)) {
  const classes = useManagementClasses();
  const placeholderLogo = classes.isDarkMode
    ? '/images/logos/sundai_logo_dark_horizontal.svg'
    : '/images/logos/sundai_logo_light_horizontal.svg';

  const content = (
    <>
      <div
        className={`${classes.subtlePanel} relative aspect-[3/2] w-full overflow-hidden !bg-black`}
      >
        <Image
          alt={event.image?.alt || `${event.title} event`}
          className={event.image?.url ? 'object-contain' : 'object-contain p-8'}
          fill
          src={event.image?.url || placeholderLogo}
          sizes="(min-width: 640px) 420px, 100vw"
          unoptimized={Boolean(event.image?.url)}
        />
      </div>
      <div className="p-4">
        {eyebrow && (
          <div
            className={`mb-2 text-xs font-bold uppercase ${classes.mutedText}`}
          >
            {eyebrow}
          </div>
        )}
        <h3 className="font-semibold group-hover:underline">{event.title}</h3>
        <div className={`mt-1 text-sm ${classes.mutedText}`}>
          {[
            event.publicLocation,
            dateLabel ??
              (event.startTime
                ? new Date(event.startTime).toLocaleDateString(undefined, {
                    timeZone:
                      timezone ?? event.timezone ?? event.chapter?.timezone,
                  })
                : null),
          ]
            .filter(Boolean)
            .join(' · ')}
        </div>
        {showState && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {event.status && <ManagementBadge>{event.status}</ManagementBadge>}
            {event.visibility && (
              <ManagementBadge>{event.visibility}</ManagementBadge>
            )}
          </div>
        )}
        {badges && (
          <div className="mt-4 flex flex-wrap items-center gap-2">{badges}</div>
        )}
      </div>
    </>
  );
  const actionClasses =
    'group block w-full rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gray-500';

  return (
    <article
      className={`relative w-full overflow-hidden ${classes.panel} ${className} transition hover:-translate-y-0.5 hover:shadow-md`}
    >
      {href !== undefined ? (
        <Link
          aria-label={`View ${event.title}`}
          className={actionClasses}
          href={href}
        >
          {content}
        </Link>
      ) : (
        <button
          aria-label={`Select ${event.title}`}
          className={actionClasses}
          onClick={onClick}
          type="button"
        >
          {content}
        </button>
      )}
      {showEdit && (
        <div className="px-4 pb-4">
          <Link
            aria-label={`Edit ${event.title}`}
            className={classes.secondaryButton}
            href={`/organizer/events/${event.id}/settings`}
          >
            Edit
          </Link>
        </div>
      )}
    </article>
  );
}
