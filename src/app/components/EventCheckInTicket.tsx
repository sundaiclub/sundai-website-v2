'use client';

import {
  ManagementAlert,
  ManagementSection,
  useManagementClasses,
} from './ManagementSurface';

export function EventCheckInTicket({
  attendeeName,
  checkedInAt,
  eventTitle,
  qrImageUrl,
  timezone,
}: {
  attendeeName: string;
  checkedInAt: string | null;
  eventTitle: string;
  qrImageUrl: string;
  timezone: string;
}) {
  const classes = useManagementClasses();

  return (
    <ManagementSection
      title="Your check-in QR code"
      description="Show this code to an organizer when you arrive."
    >
      <div className="flex flex-col items-center gap-4 text-center">
        <div className="rounded-lg bg-white p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt={`Check-in QR code for ${attendeeName}`}
            className="h-64 w-64 sm:h-72 sm:w-72"
            height={288}
            src={qrImageUrl}
            width={288}
          />
        </div>
        <div>
          <p className="text-lg font-bold">{attendeeName}</p>
          <p className={`text-sm ${classes.mutedText}`}>{eventTitle}</p>
        </div>
        {checkedInAt && (
          <ManagementAlert tone="success">
            Checked in at{' '}
            {new Date(checkedInAt).toLocaleTimeString(undefined, {
              hour: 'numeric',
              minute: '2-digit',
              timeZone: timezone,
            })}
          </ManagementAlert>
        )}
      </div>
    </ManagementSection>
  );
}
