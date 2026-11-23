'use client';

import Image from 'next/image';
import { useEffect, useState, type ReactNode } from 'react';
import { formatEventSchedule } from '@/lib/eventDateTime';
import type { PublicEventDetail } from '@/types/event-management';
import { useManagementClasses } from './ManagementSurface';

function mapsUrl(address: string, useAppleMaps: boolean) {
  const query = encodeURIComponent(address);
  return useAppleMaps
    ? `https://maps.apple.com/?q=${query}`
    : `https://www.google.com/maps/search/?api=1&query=${query}`;
}

function AddressLink({ address }: { address: string }) {
  // Apple devices open Apple Maps. Everything else opens Google Maps. The
  // device is only known in the browser, so the link starts as Google Maps.
  const [useAppleMaps, setUseAppleMaps] = useState(false);
  useEffect(() => {
    setUseAppleMaps(/iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent));
  }, []);

  return (
    <a
      aria-label={`Open ${address} in maps`}
      className="underline decoration-dotted underline-offset-4 outline-none hover:decoration-solid focus-visible:ring-2"
      href={mapsUrl(address, useAppleMaps)}
      rel="noopener noreferrer"
      target="_blank"
    >
      {address}
    </a>
  );
}

export function PublicEventHero({
  event,
  mapsAddress,
  actions,
  chapterActions,
}: {
  event: PublicEventDetail;
  // The full address shown to approved attendees. It links to a maps app.
  mapsAddress?: string | null;
  actions?: ReactNode;
  chapterActions?: ReactNode;
}) {
  const classes = useManagementClasses();
  const placeholderLogo = classes.isDarkMode
    ? '/images/logos/sundai_logo_dark_horizontal.svg'
    : '/images/logos/sundai_logo_light_horizontal.svg';
  const iconClassName = `mt-0.5 h-5 w-5 shrink-0 ${classes.mutedText}`;

  return (
    <article className={`${classes.panel} overflow-hidden`}>
      <div className="relative aspect-video w-full overflow-hidden bg-black">
        <Image
          alt={event.image?.alt || `${event.title} event`}
          className={
            event.image?.url ? 'object-contain' : 'object-contain p-10 sm:p-16'
          }
          fill
          priority
          sizes="(min-width: 1024px) 384px, 100vw"
          src={event.image?.url || placeholderLogo}
          unoptimized={Boolean(event.image?.url)}
        />
        {event.image?.url && (
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/45 to-transparent" />
        )}
      </div>

      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <p
            className={`text-xs font-bold uppercase tracking-[0.18em] ${classes.mutedText}`}
          >
            {event.chapterName}
          </p>
          {chapterActions && (
            <div className="flex flex-wrap items-center gap-1.5 [&>span]:min-h-5 [&>span]:px-2 [&>span]:py-0.5 [&>span]:text-[10px]">
              {chapterActions}
            </div>
          )}
        </div>
        <h1 className="mt-3 text-balance text-3xl font-bold leading-tight sm:text-4xl">
          {event.title}
        </h1>
        {actions && (
          <div
            className={`mt-5 grid gap-2 border-t pt-5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 ${classes.isDarkMode ? 'border-gray-800' : 'border-gray-200'}`}
          >
            {actions}
          </div>
        )}

        <dl
          className={`mt-6 grid gap-4 border-t pt-5 ${classes.isDarkMode ? 'border-gray-800' : 'border-gray-200'}`}
        >
          <div className="flex gap-3">
            <svg
              aria-hidden="true"
              className={iconClassName}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6.75 3v2.25M17.25 3v2.25M3.75 9h16.5m-15 12h13.5a1.5 1.5 0 0 0 1.5-1.5V6.75a1.5 1.5 0 0 0-1.5-1.5H5.25a1.5 1.5 0 0 0-1.5 1.5V19.5a1.5 1.5 0 0 0 1.5 1.5Z"
              />
            </svg>
            <div>
              <dt
                className={`text-xs font-bold uppercase tracking-wide ${classes.mutedText}`}
              >
                When
              </dt>
              <dd className="mt-1 text-base font-semibold leading-7">
                {formatEventSchedule(
                  event.startTime,
                  event.endTime,
                  event.timezone
                )}
              </dd>
            </div>
          </div>
          <div className="flex gap-3">
            <svg
              aria-hidden="true"
              className={iconClassName}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 21s6.75-5.4 6.75-12A6.75 6.75 0 1 0 5.25 9C5.25 15.6 12 21 12 21Z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M14.25 9a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z"
              />
            </svg>
            <div>
              <dt
                className={`text-xs font-bold uppercase tracking-wide ${classes.mutedText}`}
              >
                Where
              </dt>
              <dd className="mt-1 text-base font-semibold leading-7">
                {mapsAddress ? (
                  <AddressLink address={mapsAddress} />
                ) : (
                  event.publicLocation || 'Location to be announced'
                )}
              </dd>
            </div>
          </div>
        </dl>
      </div>
    </article>
  );
}
