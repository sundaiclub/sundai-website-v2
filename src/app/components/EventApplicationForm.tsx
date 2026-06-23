'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  applyProfilePrefillToAnswers,
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
  ManagementAlert,
  ManagementSection,
  useManagementClasses,
} from './ManagementSurface';

function jsonObject(value: JsonValue | null | undefined): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value;
}

function fieldValueToString(value: JsonValue | undefined) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return '';
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
}) {
  return applyProfilePrefillToAnswers({
    fields: input.fields,
    profile: input.profile,
    existingAnswers: jsonObject(input.registration?.answersJson),
  });
}

function inputTypeFor(field: TemplateFieldDefinition) {
  if (field.type === 'EMAIL') return 'email';
  if (field.type === 'PHONE') return 'tel';
  if (field.type === 'URL') return 'url';
  if (field.type === 'NUMBER') return 'number';
  if (field.type === 'DATE') return 'date';
  if (field.type === 'DATETIME') return 'datetime-local';
  return 'text';
}

function normalizeSubmissionValue(
  field: TemplateFieldDefinition,
  value: string
): JsonValue {
  if (field.type === 'NUMBER') {
    return value.trim() ? Number(value) : null;
  }

  if (field.type === 'BOOLEAN') {
    return value === 'true';
  }

  return value;
}

function FieldInput({
  field,
  value,
  error,
  onChange,
}: {
  field: TemplateFieldDefinition;
  value: JsonValue | undefined;
  error?: string;
  onChange: (value: JsonValue) => void;
}) {
  const classes = useManagementClasses();
  const inputId = `application-${field.id}`;
  const stringValue = fieldValueToString(value);

  return (
    <div className="grid gap-2">
      <label className="text-sm font-semibold" htmlFor={inputId}>
        {field.label}
        {field.required && <span aria-hidden="true"> *</span>}
      </label>
      {field.type === 'TEXTAREA' ? (
        <textarea
          className={classes.textarea}
          id={inputId}
          onChange={event => onChange(event.target.value)}
          placeholder={field.placeholder ?? undefined}
          value={stringValue}
        />
      ) : field.type === 'SELECT' ? (
        <select
          className={classes.input}
          id={inputId}
          onChange={event => onChange(event.target.value)}
          value={stringValue}
        >
          <option value="">Select an option</option>
          {(field.options ?? []).map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      ) : field.type === 'BOOLEAN' ? (
        <select
          className={classes.input}
          id={inputId}
          onChange={event => onChange(normalizeSubmissionValue(field, event.target.value))}
          value={stringValue}
        >
          <option value="">Select an option</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      ) : (
        <input
          className={classes.input}
          id={inputId}
          onChange={event =>
            onChange(normalizeSubmissionValue(field, event.target.value))
          }
          placeholder={field.placeholder ?? undefined}
          type={inputTypeFor(field)}
          value={stringValue}
        />
      )}
      {field.helpText && (
        <p className={`text-xs ${classes.mutedText}`}>{field.helpText}</p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

export function EventApplicationForm({
  event,
  viewerProfile,
  onRegistrationChange,
}: {
  event: PublicEventDetail;
  viewerProfile?: ProfilePrefillSource | null;
  onRegistrationChange?: (registration: PublicRegistrationResponse) => void;
}) {
  const classes = useManagementClasses();
  const fields = event.applicationQuestionSet.composedFields;
  const registration = event.viewerRegistration;
  const controls: ApplicationControlsState = event.applicationControls;
  const [isEditing, setIsEditing] = useState(
    controls.canSubmit && !registration
  );
  const [answers, setAnswers] = useState<JsonObject>(() =>
    initialAnswers({ fields, profile: viewerProfile, registration })
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittedAt = formatSubmittedAt(registration?.submittedAt);

  useEffect(() => {
    setAnswers(initialAnswers({ fields, profile: viewerProfile, registration }));
    setIsEditing(controls.canSubmit && !registration);
  }, [controls.canSubmit, fields, registration, viewerProfile]);

  const canShowForm = fields.length > 0 && (controls.canSubmit || isEditing);
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
    const validationErrors = validateRequiredApplicationAnswers(fields, answers);
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
          body: JSON.stringify({ answersJson: answers }),
        }
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.message || 'Unable to save application.');
      }
      setActionMessage(
        registration ? 'Application updated.' : 'Application submitted.'
      );
      setIsEditing(false);
      if (payload) onRegistrationChange?.(payload);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : 'Unable to save application.'
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (fields.length === 0 && !registration) return null;

  return (
    <ManagementSection title="Application">
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
            onSubmit={event => {
              event.preventDefault();
              void submit();
            }}
          >
            {fields.map(field => (
              <FieldInput
                error={fieldErrors[field.id]}
                field={field}
                key={field.id}
                onChange={value => updateAnswer(field, value)}
                value={answers[field.id]}
              />
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
    </ManagementSection>
  );
}
