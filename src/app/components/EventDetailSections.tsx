'use client';

import { useEffect, useState } from 'react';
import { sanitizeApprovedDetailsJson } from '@/lib/approvedEventDetails';
import type {
  AddToCalendarPayload,
  JsonObject,
  ProfilePrefillSource,
  PublicEventDetail,
  RegistrationStatus,
} from '@/types/event-management';
import {
  ManagementAlert,
  ManagementSection,
  useManagementClasses,
} from './ManagementSurface';
import { EventApplicationForm } from './EventApplicationForm';
import { ViewerRegistrationStatusBadge } from './PublicEventCard';
import EventMarkdown from './EventMarkdown';
import { SignInAction } from './SignInAction';

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
      <dl className="grid gap-4">
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

function EventApprovedDetailsSection({ event }: { event: PublicEventDetail }) {
  const entries = event.approvedDetailsJson
    ? detailEntries(event.approvedDetailsJson)
    : [];

  if (!event.approvedDetailsVisible || entries.length === 0) return null;

  return (
    <ManagementSection title="Event-specific details" size="large">
      <ApprovedOnlyDetails event={event} />
    </ManagementSection>
  );
}

function EventTopRegistrationStatusSection({
  event,
}: {
  event: PublicEventDetail;
}) {
  const classes = useManagementClasses();
  const registration = event.viewerRegistration;
  const registrationStatus =
    registration?.status ?? event.viewerRegistrationStatus;
  const isEventStaff = Boolean(event.viewerEventStaffRole);
  const displayStatus = isEventStaff ? 'APPROVED' : registrationStatus;

  if (!displayStatus) {
    if (
      event.applicationControls.publicMessage &&
      !event.applicationControls.signInRequired
    ) {
      return (
        <ManagementAlert>{event.applicationControls.publicMessage}</ManagementAlert>
      );
    }

    return null;
  }

  const isPending = displayStatus === 'PENDING';

  return (
    <ManagementSection
      actions={<ViewerRegistrationStatusBadge status={displayStatus} />}
      description={
        isEventStaff
          ? 'Use the Manage button in the top right to approve users or make changes to the event.'
          : event.applicationControls.publicMessage ||
            registration?.publicSafeMessage ||
            (isPending
              ? 'Your application is pending review.'
              : 'Your place at this event is confirmed.')
      }
      size="large"
      title={
        isEventStaff ? 'You are an MC' : registrationHeading(registrationStatus)
      }
    >
      <div className="flex flex-wrap gap-2">
        {isPending && registration?.canEditAnswers && (
          <EventRegistrationAction
            allowEditing
            event={event}
            viewerProfile={event.viewerProfile}
          />
        )}
        {!isEventStaff && registration?.canCancel && (
          <button type="button" className={classes.secondaryButton}>
            Cancel registration
          </button>
        )}
      </div>
    </ManagementSection>
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

export function EventRegistrationAction({
  event,
  viewerProfile,
  allowEditing = false,
}: {
  event: PublicEventDetail;
  viewerProfile?: ProfilePrefillSource | null;
  allowEditing?: boolean;
}) {
  const classes = useManagementClasses();
  const [isOpen, setIsOpen] = useState(false);
  const canRegister =
    !event.viewerRegistration &&
    (event.applicationControls.signInRequired ||
      (event.applicationControls.canSubmit &&
        event.applicationQuestionSet.composedFields.length > 0));
  const canEdit = Boolean(
    allowEditing && event.viewerRegistration?.canEditAnswers
  );

  useEffect(() => {
    if (!isOpen) return;
    function closeOnEscape(keyEvent: KeyboardEvent) {
      if (keyEvent.key === 'Escape') setIsOpen(false);
    }
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [isOpen]);

  if (!canRegister && !canEdit) return null;

  return (
    <>
      <button
        aria-haspopup="dialog"
        className={canEdit ? classes.secondaryButton : classes.primaryButton}
        onClick={() => setIsOpen(true)}
        type="button"
      >
        {canEdit ? 'Edit application' : 'Register'}
      </button>
      {isOpen && (
        <div
          aria-labelledby="registration-dialog-title"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onMouseDown={event => {
            if (event.currentTarget === event.target) setIsOpen(false);
          }}
          role="dialog"
        >
          <div
            className={`${classes.panel} max-h-[90vh] w-full max-w-2xl overflow-y-auto p-5 sm:p-7`}
            style={{
              backgroundColor: classes.isDarkMode ? '#111827' : '#ffffff',
            }}
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p
                  className={`text-xs font-bold uppercase ${classes.mutedText}`}
                >
                  {event.title}
                </p>
                <h2
                  className="mt-1 text-2xl font-bold"
                  id="registration-dialog-title"
                >
                  {canEdit
                    ? 'Edit your application'
                    : 'Register for this event'}
                </h2>
              </div>
              <button
                aria-label="Close registration"
                className={classes.ghostButton}
                onClick={() => setIsOpen(false)}
                type="button"
              >
                <span aria-hidden="true">✕</span>
              </button>
            </div>
            {event.applicationControls.signInRequired ? (
              <SignInAction label="Sign in to register" />
            ) : (
              <EventApplicationForm
                embedded
                event={event}
                hideStartButton
                initialEditing
                viewerProfile={viewerProfile}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}

function EventDescriptionSection({ event }: { event: PublicEventDetail }) {
  const classes = useManagementClasses();

  if (!event.description) return null;

  return (
    <ManagementSection title="About this event" size="large">
      <EventMarkdown
        className={`prose max-w-none whitespace-pre-wrap text-base leading-7 prose-headings:mb-2 prose-headings:mt-4 prose-p:my-2 prose-a:text-current prose-li:my-0 ${
          classes.isDarkMode ? 'prose-invert' : 'prose-gray'
        } ${classes.mutedText}`}
        markdown={event.description}
      />
    </ManagementSection>
  );
}

export function EventNarrativeColumn({ event }: { event: PublicEventDetail }) {
  const midpoint = event.endTime
    ? (new Date(event.startTime).getTime() +
        new Date(event.endTime).getTime()) /
      2
    : Number.POSITIVE_INFINITY;
  const [pitchFirst, setPitchFirst] = useState(false);

  useEffect(() => {
    let timeout: number | undefined;

    function updateAndSchedule() {
      const isPastMidpoint = Date.now() >= midpoint;
      setPitchFirst(isPastMidpoint);
      if (!Number.isFinite(midpoint) || isPastMidpoint) return;
      timeout = window.setTimeout(
        updateAndSchedule,
        Math.min(midpoint - Date.now(), 2_147_000_000)
      );
    }

    updateAndSchedule();
    return () => {
      if (timeout !== undefined) window.clearTimeout(timeout);
    };
  }, [midpoint]);

  const pitch = (
    <EventPitchSection
      eventId={event.pitchSession ? event.id : null}
      phase={event.pitchSession?.phase}
    />
  );
  const description = <EventDescriptionSection event={event} />;
  const registrationStatus = (
    <EventTopRegistrationStatusSection event={event} />
  );
  const approvedDetails = <EventApprovedDetailsSection event={event} />;

  return (
    <div className="grid content-start gap-5">
      {pitchFirst && pitch}
      {registrationStatus}
      {approvedDetails}
      {description}
      {!pitchFirst && pitch}
    </div>
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
        <a
          className={`${classes.primaryButton} whitespace-nowrap !px-3`}
          href={`/pitch/${eventId}`}
        >
          Go to pitch
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
