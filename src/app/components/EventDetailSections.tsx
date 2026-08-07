'use client';

import { sanitizeApprovedDetailsJson } from '@/lib/approvedEventDetails';
import type {
  AddToCalendarPayload,
  JsonObject,
  ProfilePrefillSource,
  PublicEventDetail,
  RegistrationStatus,
} from '@/types/event-management';
import { ManagementSection, useManagementClasses } from './ManagementSurface';
import { EventApplicationForm } from './EventApplicationForm';
import { ViewerRegistrationStatusBadge } from './PublicEventCard';

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
  return Object.entries(sanitizeApprovedDetailsJson(details)).filter(
    (entry): entry is [string, string | number | boolean] =>
      ['string', 'number', 'boolean'].includes(typeof entry[1]) &&
      entry[0].replace(/[^a-z0-9]/gi, '').toLowerCase() !== 'address'
  );
}

function ApprovedOnlyDetails({
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
    <div>
      <h3 className="text-base font-bold">Event-specific details</h3>
      <dl className="mt-4 grid gap-4">
        {entries.map(([key, value]) => (
          <div key={key}>
            {key.replace(/[^a-z0-9]/gi, '').toLowerCase() !== 'details' && (
              <dt
                className={`text-xs font-bold uppercase ${classes.mutedText}`}
              >
                {humanizeKey(key)}
              </dt>
            )}
            <dd
              className={`${key.replace(/[^a-z0-9]/gi, '').toLowerCase() === 'details' ? '' : 'mt-1'} whitespace-pre-wrap text-base leading-7`}
            >
              {String(value)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function registrationHeading(status?: RegistrationStatus | null) {
  if (status === 'APPROVED') return 'You have been approved';
  if (status === 'PENDING') return 'Your application is pending';
  if (status === 'WAITLISTED') return 'You are on the waitlist';
  if (status === 'DECLINED') return 'Your application was declined';
  if (status === 'BLOCKED') return 'Registration is unavailable';
  if (status === 'CANCELLED') return 'Your registration was cancelled';
  return 'Registration';
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

export function EventProgramHighlights({
  format,
  partners,
  experts,
}: {
  format?: string | null;
  partners?: string | null;
  experts?: string | null;
}) {
  const classes = useManagementClasses();
  const highlights = [
    { label: 'Format', value: format, emphasize: true },
    { label: 'Partners', value: partners },
    { label: 'Experts', value: experts },
  ].filter(highlight => highlight.value);

  if (highlights.length === 0) return null;

  return (
    <ManagementSection
      title="What to expect"
      description="A quick look at the event program and community."
      size="large"
    >
      <div className="grid gap-3 text-base leading-7 sm:grid-cols-3">
        {highlights.map(highlight => (
          <div className={`${classes.subtlePanel} p-4`} key={highlight.label}>
            <p
              className={`text-xs font-bold uppercase tracking-wide ${classes.mutedText}`}
            >
              {highlight.label}
            </p>
            <p className={`mt-2 ${highlight.emphasize ? 'font-semibold' : ''}`}>
              {highlight.value}
            </p>
          </div>
        ))}
      </div>
    </ManagementSection>
  );
}

export function EventDetailSections({
  event,
  viewerProfile,
}: {
  event: PublicEventDetail;
  viewerProfile?: ProfilePrefillSource | null;
}) {
  const classes = useManagementClasses();
  const registration = event.viewerRegistration;
  const registrationStatus =
    registration?.status ?? event.viewerRegistrationStatus;
  const showStatus = Boolean(
    registrationStatus || event.applicationControls.publicMessage
  );
  const showApplication = Boolean(
    registration?.canEditAnswers ||
      (event.applicationQuestionSet.composedFields.length > 0 &&
        event.applicationControls.canSubmit)
  );
  const approvedEntries = event.approvedDetailsJson
    ? detailEntries(event.approvedDetailsJson)
    : [];
  const showApproved =
    event.approvedDetailsVisible && approvedEntries.length > 0;

  if (!showStatus && !showApplication && !showApproved) return null;

  return (
    <ManagementSection
      title={registrationHeading(registrationStatus)}
      description={
        event.applicationControls.publicMessage ||
        (registrationStatus === 'APPROVED'
          ? 'Your place at this event is confirmed.'
          : 'Apply to take part in this event.')
      }
      actions={
        registrationStatus ? (
          <ViewerRegistrationStatusBadge status={registrationStatus} />
        ) : null
      }
      size="large"
    >
      <div className={`grid gap-6 divide-y ${classes.divider}`}>
        {showApproved && <ApprovedOnlyDetails event={event} />}
        {showApplication && (
          <div className={showApproved ? 'pt-6' : ''}>
            <h3 className="mb-4 text-lg font-bold">Application</h3>
            <EventApplicationForm
              embedded
              event={event}
              viewerProfile={viewerProfile}
            />
          </div>
        )}
        {registration?.canCancel && (
          <div className={showApproved || showApplication ? 'pt-6' : ''}>
            <button type="button" className={classes.secondaryButton}>
              Cancel registration
            </button>
          </div>
        )}
      </div>
    </ManagementSection>
  );
}

export function EventPitchSection({
  eventId,
  phase,
}: {
  eventId?: string | null;
  phase?: string | null;
}) {
  const classes = useManagementClasses();

  if (!eventId || !phase) return null;

  return (
    <ManagementSection
      title="Pitch session"
      description="At the end of the event, use the pitch session to present projects to the group."
      actions={
        <a className={classes.primaryButton} href={`/pitch/${eventId}`}>
          Open pitch event
          <span aria-hidden="true">→</span>
        </a>
      }
      size="large"
    >
      <p className="text-base leading-7">
        The pitch session is currently {phase.toLowerCase()}. It keeps the
        presentation queue, timer, and voting in one place.
      </p>
    </ManagementSection>
  );
}

export type PublicEventMaterialLink = {
  id: string;
  title: string;
  description?: string | null;
  href: string;
  kind: 'LINK' | 'FILE';
};

export function EventMaterialsSection({
  materials,
}: {
  materials: PublicEventMaterialLink[];
}) {
  const classes = useManagementClasses();

  if (materials.length === 0) return null;

  return (
    <ManagementSection
      title="Event materials"
      description="Useful links and files for this event."
      size="large"
    >
      <ul className="grid gap-3 sm:grid-cols-2">
        {materials.map(material => (
          <li className={`${classes.subtlePanel} p-4`} key={material.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p
                  className={`text-xs font-bold uppercase tracking-wide ${classes.mutedText}`}
                >
                  {material.kind === 'FILE' ? 'File' : 'Link'}
                </p>
                <a
                  className="mt-1 inline-flex items-center gap-2 text-lg font-semibold underline-offset-4 hover:underline"
                  href={material.href}
                  {...(material.kind === 'LINK'
                    ? { rel: 'noopener noreferrer' }
                    : {})}
                >
                  {material.title}
                  <span aria-hidden="true">↗</span>
                </a>
              </div>
            </div>
            {material.description && (
              <p className={`mt-2 text-base leading-7 ${classes.mutedText}`}>
                {material.description}
              </p>
            )}
          </li>
        ))}
      </ul>
    </ManagementSection>
  );
}
