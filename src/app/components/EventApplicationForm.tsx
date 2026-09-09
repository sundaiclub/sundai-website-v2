'use client';

import Link from 'next/link';
import { ApplicationFieldInput } from './ApplicationFieldInput';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  applyProfilePrefillToAnswers,
  shouldReusePreviousApplicationAnswer,
  validateRequiredApplicationAnswers,
} from '@/lib/applicationTemplates';
import type {
  ApplicationControlsState,
  JsonObject,
  JsonValue,
  ProfilePrefillSource,
  PublicEventDetail,
  PublicRegistrationResponse,
  PublicViewerRegistrationState,
  TemplateFieldDefinition,
} from '@/types/event-management';
import {
  SMS_CONSENT_COPY,
  SMS_CONSENT_CONFIGURED,
  SMS_CONSENT_VERSION,
} from '@/lib/smsConsent';
import {
  ManagementAlert,
  ManagementSection,
  useManagementClasses,
} from './ManagementSurface';

function jsonObject(value: JsonValue | null | undefined): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value;
}

function formatSubmittedAt(value?: string | Date | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(new Date(value));
}

function initialAnswers(input: {
  fields: readonly TemplateFieldDefinition[];
  profile?: ProfilePrefillSource | null;
  registration?: PublicViewerRegistrationState | null;
  reusableAnswers?: JsonObject | null;
}) {
  const profileAnswers = applyProfilePrefillToAnswers({
    fields: input.fields,
    profile: input.profile,
  });
  const reusableAnswers = jsonObject(input.reusableAnswers);
  const existingAnswers = jsonObject(input.registration?.answersJson);
  const answers = input.fields.reduce<JsonObject>((result, field) => {
    if (
      shouldReusePreviousApplicationAnswer(field) &&
      reusableAnswers[field.id] !== undefined
    ) {
      result[field.id] = reusableAnswers[field.id];
    }
    return result;
  }, profileAnswers);
  Object.assign(answers, existingAnswers);

  for (const field of input.fields) {
    if (field.type === 'CHECKBOX' && answers[field.id] === undefined) {
      answers[field.id] = false;
    }
  }

  return answers;
}

export function EventApplicationForm({
  event,
  viewerProfile,
  onRegistrationChange,
  embedded = false,
  initialEditing = false,
  hideStartButton = false,
}: {
  event: PublicEventDetail;
  viewerProfile?: ProfilePrefillSource | null;
  onRegistrationChange?: (registration: PublicRegistrationResponse) => void;
  embedded?: boolean;
  initialEditing?: boolean;
  hideStartButton?: boolean;
}) {
  const classes = useManagementClasses();
  const router = useRouter();
  const fields = event.applicationQuestionSet.composedFields;
  const registration = event.viewerRegistration;
  const controls: ApplicationControlsState = event.applicationControls;
  const [isEditing, setIsEditing] = useState(initialEditing);
  const [answers, setAnswers] = useState<JsonObject>(() =>
    initialAnswers({
      fields,
      profile: viewerProfile,
      registration,
      reusableAnswers: event.reusableAnswersJson,
    })
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const savedPreferences = event.viewerNotificationPreferences;
  const savedEmailPreference =
    savedPreferences?.notificationsAllowed === true &&
    savedPreferences.emailNotificationsEnabled === true;
  const savedSmsPreference =
    savedPreferences?.notificationsAllowed === true &&
    savedPreferences.smsNotificationsEnabled === true &&
    Boolean(savedPreferences.smsConsentAt) &&
    savedPreferences.smsConsentVersion === SMS_CONSENT_VERSION;
  const [emailNotificationsEnabled, setEmailNotificationsEnabled] =
    useState(savedEmailPreference);
  const [smsConsentGranted, setSmsConsentGranted] =
    useState(savedSmsPreference);
  const submittedAt = formatSubmittedAt(registration?.submittedAt);

  useEffect(() => {
    setAnswers(
      initialAnswers({
        fields,
        profile: viewerProfile,
        registration,
        reusableAnswers: event.reusableAnswersJson,
      })
    );
    setEmailNotificationsEnabled(savedEmailPreference);
    setSmsConsentGranted(savedSmsPreference);
    setIsEditing(initialEditing);
  }, [
    controls.canSubmit,
    event.reusableAnswersJson,
    fields,
    registration,
    initialEditing,
    savedEmailPreference,
    savedSmsPreference,
    viewerProfile,
  ]);

  const canStartRegistration =
    fields.length > 0 &&
    controls.canSubmit &&
    !registration &&
    !isEditing &&
    !actionMessage &&
    !hideStartButton;
  const canShowForm = fields.length > 0 && isEditing;
  const submitLabel = registration ? 'Save changes' : 'Submit application';

  const fieldErrors = useMemo(() => errors, [errors]);

  function updateAnswer(field: TemplateFieldDefinition, value: JsonValue) {
    setAnswers(current => ({ ...current, [field.id]: value }));
    setErrors(current => {
      const next = { ...current };
      delete next[field.id];
      return next;
    });
  }

  async function submit() {
    const validationErrors = validateRequiredApplicationAnswers(
      fields,
      answers
    );
    if (validationErrors.length > 0) {
      setErrors(
        Object.fromEntries(
          validationErrors.map(error => [error.fieldId, error.message])
        )
      );
      return;
    }

    setIsSubmitting(true);
    setActionError('');
    setActionMessage('');
    try {
      const response = await fetch(
        registration
          ? `/api/events/${event.id}/registrations/me`
          : `/api/events/${event.id}/registrations`,
        {
          method: registration ? 'PATCH' : 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            answersJson: answers,
            emailNotificationsEnabled,
            smsNotificationsEnabled: smsConsentGranted,
            smsConsentGranted,
          }),
        }
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        if (Array.isArray(payload?.issues)) {
          setErrors(
            Object.fromEntries(
              payload.issues
                .filter(
                  (issue: unknown) =>
                    typeof issue === 'object' &&
                    issue !== null &&
                    'fieldId' in issue &&
                    typeof issue.fieldId === 'string' &&
                    'message' in issue &&
                    typeof issue.message === 'string'
                )
                .map((issue: { fieldId: string; message: string }) => [
                  issue.fieldId,
                  issue.message,
                ])
            )
          );
        }
        throw new Error(payload?.message || 'Unable to save application.');
      }
      setActionMessage(
        registration ? 'Application updated.' : 'Application submitted.'
      );
      setIsEditing(false);
      if (payload) onRegistrationChange?.(payload);
      router.refresh();
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : 'Unable to save application.'
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (fields.length === 0 && !registration) return null;

  const content = (
    <div className="grid gap-4">
      {submittedAt && (
        <p className={`text-sm ${classes.mutedText}`}>
          Submitted {submittedAt}
        </p>
      )}
      {actionMessage && (
        <ManagementAlert tone="success">{actionMessage}</ManagementAlert>
      )}
      {actionError && (
        <ManagementAlert tone="danger">{actionError}</ManagementAlert>
      )}

      {canStartRegistration && (
        <div>
          <button
            aria-controls="event-registration-form"
            aria-expanded="false"
            className={classes.primaryButton}
            onClick={() => setIsEditing(true)}
            type="button"
          >
            Register
          </button>
        </div>
      )}

      {!isEditing && registration?.canEditAnswers && (
        <button
          className={classes.secondaryButton}
          onClick={() => setIsEditing(true)}
          type="button"
        >
          Edit application
        </button>
      )}

      {canShowForm && (
        <form
          className="grid gap-4"
          id="event-registration-form"
          onSubmit={event => {
            event.preventDefault();
            void submit();
          }}
        >
          {fields.map(field => (
            <div className="grid gap-3" key={field.id}>
              <ApplicationFieldInput
                error={fieldErrors[field.id]}
                field={field}
                onChange={value => updateAnswer(field, value)}
                value={answers[field.id]}
              />
              {field.id === 'email' && field.type === 'EMAIL' && (
                <div className={`${classes.subtlePanel} grid gap-2 p-3`}>
                  <label
                    className="flex items-start gap-3"
                    htmlFor="application-email-notifications"
                  >
                    <input
                      checked={emailNotificationsEnabled}
                      className={`${classes.checkbox} mt-1`}
                      id="application-email-notifications"
                      onChange={event =>
                        setEmailNotificationsEnabled(event.target.checked)
                      }
                      type="checkbox"
                    />
                    <span className="text-sm font-semibold">
                      Email me about this event and other {event.chapterName}{' '}
                      events.
                    </span>
                  </label>
                  <p className={`pl-7 text-xs ${classes.mutedText}`}>
                    You can change this setting on the chapter preferences page.
                  </p>
                </div>
              )}
              {field.id === 'phoneNumber' && field.type === 'PHONE' && (
                <div className={`${classes.subtlePanel} grid gap-2 p-3`}>
                  <label
                    className="flex items-start gap-3"
                    htmlFor="application-sms-consent"
                  >
                    <input
                      checked={smsConsentGranted}
                      className={`${classes.checkbox} mt-1`}
                      disabled={!SMS_CONSENT_CONFIGURED}
                      id="application-sms-consent"
                      onChange={event =>
                        setSmsConsentGranted(event.target.checked)
                      }
                      type="checkbox"
                    />
                    <span className="text-xs leading-5">
                      {SMS_CONSENT_CONFIGURED
                        ? SMS_CONSENT_COPY
                        : 'Text message updates are not currently available.'}
                    </span>
                  </label>
                  {SMS_CONSENT_CONFIGURED && (
                    <p className={`pl-7 text-xs ${classes.mutedText}`}>
                      Read the{' '}
                      <Link
                        className="font-semibold underline underline-offset-2"
                        href="/terms"
                      >
                        Terms of Service
                      </Link>{' '}
                      and{' '}
                      <Link
                        className="font-semibold underline underline-offset-2"
                        href="/privacy"
                      >
                        Privacy Policy
                      </Link>
                      .
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
          <div>
            <button
              className={classes.primaryButton}
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? 'Saving' : submitLabel}
            </button>
          </div>
        </form>
      )}
    </div>
  );

  if (embedded) return content;

  return <ManagementSection title="Application">{content}</ManagementSection>;
}
