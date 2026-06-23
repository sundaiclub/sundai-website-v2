'use client';

import type {
  AddToCalendarPayload,
  JsonObject,
  PublicEventDetail,
  PublicViewerRegistrationState,
  RegistrationStatus,
} from '@/types/event-management';
import {
  ManagementBadge,
  ManagementSection,
  useManagementClasses,
} from './ManagementSurface';
import { EventApplicationForm } from './EventApplicationForm';

type ViewerProfile = {
  name?: string | null;
  email?: string | null;
  username?: string | null;
  phoneNumber?: string | null;
};

function formatDateTime(value: string | Date, timezone?: string) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'long',
    timeStyle: 'short',
    timeZone: timezone,
  }).format(new Date(value));
}

function formatStatus(status?: RegistrationStatus | null) {
  if (!status) return null;
  return status.replace(/_/g, ' ').toLowerCase();
}

function encodeCalendarDate(value: string | Date) {
  return new Date(value)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
}

function googleCalendarHref(payload: AddToCalendarPayload) {
  const dates = `${encodeCalendarDate(payload.startTime)}/${encodeCalendarDate(
    payload.endTime ?? payload.startTime
  )}`;
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: payload.title,
    dates,
  });

  if (payload.description) params.set('details', payload.description);
  if (payload.location) params.set('location', payload.location);

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

function humanizeKey(key: string) {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}

function detailEntries(details: JsonObject) {
  return Object.entries(details).filter(
    (entry): entry is [string, string | number | boolean] =>
      ['string', 'number', 'boolean'].includes(typeof entry[1])
  );
}

export function EventScheduleSummary({ event }: { event: PublicEventDetail }) {
  const classes = useManagementClasses();

  return (
    <ManagementSection title="Event details">
      <dl className="grid gap-4 sm:grid-cols-2">
        <div>
          <dt className={`text-xs font-bold uppercase ${classes.mutedText}`}>
            Chapter
          </dt>
          <dd className="mt-1 font-semibold">{event.chapterName}</dd>
        </div>
        <div>
          <dt className={`text-xs font-bold uppercase ${classes.mutedText}`}>
            Location
          </dt>
          <dd className="mt-1 font-semibold">
            {event.publicLocation || 'Location to be announced'}
          </dd>
        </div>
        <div>
          <dt className={`text-xs font-bold uppercase ${classes.mutedText}`}>
            Starts
          </dt>
          <dd className="mt-1 font-semibold">
            {formatDateTime(event.startTime, event.chapter.timezone)}
          </dd>
        </div>
        {event.endTime && (
          <div>
            <dt className={`text-xs font-bold uppercase ${classes.mutedText}`}>
              Ends
            </dt>
            <dd className="mt-1 font-semibold">
              {formatDateTime(event.endTime, event.chapter.timezone)}
            </dd>
          </div>
        )}
      </dl>
    </ManagementSection>
  );
}

export function ApprovedOnlyDetails({
  event,
}: {
  event: Pick<
    PublicEventDetail,
    'approvedDetailsVisible' | 'approvedDetailsJson'
  >;
}) {
  const classes = useManagementClasses();

  if (!event.approvedDetailsVisible || !event.approvedDetailsJson) return null;

  const entries = detailEntries(event.approvedDetailsJson);
  if (entries.length === 0) return null;

  return (
    <ManagementSection title="Approved attendee details">
      <dl className="grid gap-4">
        {entries.map(([key, value]) => (
          <div key={key}>
            <dt className={`text-xs font-bold uppercase ${classes.mutedText}`}>
              {humanizeKey(key)}
            </dt>
            <dd className="mt-1 whitespace-pre-wrap text-sm leading-6">
              {String(value)}
            </dd>
          </div>
        ))}
      </dl>
    </ManagementSection>
  );
}

export function ViewerRegistrationPanel({
  registration,
  message,
}: {
  registration?: PublicViewerRegistrationState | null;
  message?: string | null;
}) {
  const classes = useManagementClasses();
  const status = formatStatus(registration?.status);

  if (!registration && !message) return null;

  return (
    <ManagementSection
      title="Your status"
      actions={
        status ? (
          <ManagementBadge
            tone={registration?.status === 'APPROVED' ? 'success' : 'warning'}
          >
            {status}
          </ManagementBadge>
        ) : null
      }
    >
      {message && (
        <p className={`text-sm leading-6 ${classes.mutedText}`}>{message}</p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {registration?.canCancel && (
          <button type="button" className={classes.secondaryButton}>
            Cancel registration
          </button>
        )}
      </div>
    </ManagementSection>
  );
}

export function AddToCalendarAction({
  payload,
}: {
  payload: AddToCalendarPayload;
}) {
  const classes = useManagementClasses();

  return (
    <a className={classes.primaryButton} href={googleCalendarHref(payload)}>
      Add to calendar
    </a>
  );
}

export function EventDetailSections({
  event,
  viewerProfile,
}: {
  event: PublicEventDetail;
  viewerProfile?: ViewerProfile | null;
}) {
  return (
    <div className="grid gap-5">
      <EventScheduleSummary event={event} />
      <ViewerRegistrationPanel
        registration={event.viewerRegistration}
        message={event.applicationControls.publicMessage}
      />
      <EventApplicationForm event={event} viewerProfile={viewerProfile} />
      <ApprovedOnlyDetails event={event} />
      <div>
        <AddToCalendarAction payload={event.addToCalendar} />
      </div>
    </div>
  );
}
