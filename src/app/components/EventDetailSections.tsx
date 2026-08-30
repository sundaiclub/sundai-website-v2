'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
import ProjectMarkdown from './ProjectMarkdown';
import { SignInAction } from './SignInAction';
import { AddProjectDialog } from './AddProjectDialog';

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
      ((typeof entry[1] === 'string' && entry[1].trim().length > 0) ||
        typeof entry[1] === 'number' ||
        typeof entry[1] === 'boolean') &&
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
        <ManagementAlert>
          {event.applicationControls.publicMessage}
        </ManagementAlert>
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
          <CancelRegistrationAction eventId={event.id} />
        )}
      </div>
    </ManagementSection>
  );
}

function CancelRegistrationAction({ eventId }: { eventId: string }) {
  const classes = useManagementClasses();
  const router = useRouter();
  const [isCancelling, setIsCancelling] = useState(false);
  const [isCancelled, setIsCancelled] = useState(false);
  const [error, setError] = useState('');

  async function cancelRegistration() {
    if (
      !window.confirm(
        'Cancel your registration for this event? This action cannot be undone.'
      )
    ) {
      return;
    }

    setIsCancelling(true);
    setError('');

    try {
      const response = await fetch(
        `/api/events/${encodeURIComponent(eventId)}/registrations/me/cancel`,
        { method: 'POST' }
      );
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.message || 'Unable to cancel registration.');
      }

      setIsCancelled(true);
      router.refresh();
    } catch (cancelError) {
      setError(
        cancelError instanceof Error
          ? cancelError.message
          : 'Unable to cancel registration.'
      );
    } finally {
      setIsCancelling(false);
    }
  }

  if (isCancelled) {
    return (
      <span aria-live="polite" className="text-sm" role="status">
        Registration cancelled.
      </span>
    );
  }

  return (
    <div>
      <button
        className={classes.secondaryButton}
        disabled={isCancelling}
        onClick={cancelRegistration}
        type="button"
      >
        {isCancelling ? 'Cancelling…' : 'Cancel registration'}
      </button>
      {error && (
        <p
          aria-live="assertive"
          className="mt-2 text-sm text-red-600"
          role="alert"
        >
          {error}
        </p>
      )}
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
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [registrationError, setRegistrationError] = useState('');
  const [registrationComplete, setRegistrationComplete] = useState(false);
  const applicationRequired =
    event.applicationControls.applicationRequired !== false;
  const canRegister =
    !event.viewerRegistration &&
    !registrationComplete &&
    (event.applicationControls.signInRequired ||
      (event.applicationControls.canSubmit &&
        (!applicationRequired ||
          event.applicationQuestionSet.composedFields.length > 0)));
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

  async function registerWithoutApplication() {
    setIsRegistering(true);
    setRegistrationError('');
    try {
      const response = await fetch(`/api/events/${event.id}/registrations`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({}),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.message || 'Unable to register.');
      }
      setRegistrationComplete(true);
      router.refresh();
    } catch (error) {
      setRegistrationError(
        error instanceof Error ? error.message : 'Unable to register.'
      );
    } finally {
      setIsRegistering(false);
    }
  }

  return (
    <>
      <button
        aria-haspopup={
          event.applicationControls.signInRequired || applicationRequired
            ? 'dialog'
            : undefined
        }
        className={canEdit ? classes.secondaryButton : classes.primaryButton}
        disabled={isRegistering}
        onClick={() => {
          if (
            !canEdit &&
            !event.applicationControls.signInRequired &&
            !applicationRequired
          ) {
            void registerWithoutApplication();
            return;
          }
          setIsOpen(true);
        }}
        type="button"
      >
        {canEdit
          ? 'Edit application'
          : isRegistering
            ? 'Registering...'
            : 'Register'}
      </button>
      {registrationError && (
        <ManagementAlert tone="danger">{registrationError}</ManagementAlert>
      )}
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
      <ProjectMarkdown
        className={`prose prose-lg max-w-none ${
          classes.isDarkMode
            ? 'prose-invert prose-pre:bg-gray-800 prose-a:text-indigo-400 hover:prose-a:text-indigo-300'
            : 'prose-gray prose-pre:bg-gray-100 prose-a:text-indigo-600 hover:prose-a:text-indigo-700'
        }`}
        markdown={event.description}
      />
    </ManagementSection>
  );
}

export function EventNarrativeColumn({ event }: { event: PublicEventDetail }) {
  const description = <EventDescriptionSection event={event} />;
  const registrationStatus = (
    <EventTopRegistrationStatusSection event={event} />
  );
  const approvedDetails = <EventApprovedDetailsSection event={event} />;

  return (
    <div className="grid content-start gap-5">
      {registrationStatus}
      {approvedDetails}
      {description}
    </div>
  );
}

export function EventPitchSection({
  event,
  returnTo,
}: {
  event: PublicEventDetail;
  returnTo?: string;
}) {
  const classes = useManagementClasses();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    function updateActiveState() {
      const now = Date.now();
      const start = new Date(event.startTime).getTime();
      const end = event.endTime
        ? new Date(event.endTime).getTime()
        : Number.NEGATIVE_INFINITY;
      setIsActive(now >= start && now <= end);
    }

    updateActiveState();
    const timer = window.setInterval(updateActiveState, 30_000);
    return () => window.clearInterval(timer);
  }, [event.endTime, event.startTime]);

  const registrationIsApproved =
    (event.viewerRegistration?.status ?? event.viewerRegistrationStatus) ===
      'APPROVED' && !event.viewerRegistration?.cancelledAt;
  const canAddProject =
    registrationIsApproved ||
    Boolean(event.viewerEventStaffRole) ||
    event.viewerIsSiteAdmin === true;
  const phase = event.pitchSession?.phase;

  if (!event.pitchSession || !phase || phase === 'FINISHED') return null;
  if (!isActive || !canAddProject) return null;

  return (
    <>
      <ManagementSection
        title="Add a project"
        description="Add a published project to this event and its pitch queue, or start a new project."
        actions={
          <button
            className={`${classes.primaryButton} whitespace-nowrap !px-3`}
            onClick={() => setDialogOpen(true)}
            type="button"
          >
            Add project
          </button>
        }
        size="large"
      >
        <p className="text-base leading-7">
          Choose one of your published projects or create a new project for{' '}
          {event.title}.
        </p>
      </ManagementSection>
      <AddProjectDialog
        eventId={event.id}
        eventTitle={event.title}
        onClose={() => setDialogOpen(false)}
        open={dialogOpen}
        returnTo={returnTo}
      />
    </>
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
