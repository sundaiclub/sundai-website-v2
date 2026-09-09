'use client';
import { useId } from 'react';
import type {
  JsonValue,
  TemplateFieldDefinition,
} from '@/types/event-management';
import { ApplicationChoiceField } from './ApplicationChoiceField';
import { useManagementClasses } from './ManagementSurface';
function fieldValueToString(value: JsonValue | undefined) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean')
    return String(value);
  return '';
}

function inputTypeFor(field: TemplateFieldDefinition) {
  if (field.type === 'EMAIL') return 'email';
  if (field.type === 'PHONE') return 'tel';
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

  return value;
}

export function ApplicationFieldInput({
  field,
  value,
  error,
  onChange,
  disabled = false,
}: {
  field: TemplateFieldDefinition;
  value?: JsonValue;
  error?: string;
  onChange?: (value: JsonValue) => void;
  disabled?: boolean;
}) {
  const classes = useManagementClasses();
  const inputId = useId();
  const stringValue = fieldValueToString(value);

  if (field.type === 'SELECT' || field.type === 'MULTI_SELECT') {
    return (
      <ApplicationChoiceField
        disabled={disabled}
        field={field}
        value={value}
        error={error}
        onChange={onChange}
      />
    );
  }

  if (field.type === 'CHECKBOX') {
    return (
      <div className="grid gap-2">
        <label className="flex items-start gap-3" htmlFor={inputId}>
          <input
            checked={value === true}
            className={`${classes.checkbox} mt-1`}
            disabled={disabled}
            id={inputId}
            onChange={event => onChange?.(event.target.checked)}
            type="checkbox"
          />
          <span className="text-sm font-semibold">
            {field.label}
            {field.required && <span aria-hidden="true"> *</span>}
          </span>
        </label>
        {field.helpText && (
          <p className={`text-xs ${classes.mutedText}`}>{field.helpText}</p>
        )}
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      <label className="text-sm font-semibold" htmlFor={inputId}>
        {field.label}
        {field.required && <span aria-hidden="true"> *</span>}
      </label>
      {field.type === 'TEXTAREA' ? (
        <textarea
          className={classes.textarea}
          disabled={disabled}
          id={inputId}
          onChange={event => onChange?.(event.target.value)}
          placeholder={field.placeholder ?? undefined}
          value={stringValue}
        />
      ) : (
        <input
          className={classes.input}
          disabled={disabled}
          id={inputId}
          inputMode={field.type === 'URL' ? 'url' : undefined}
          onChange={event =>
            onChange?.(normalizeSubmissionValue(field, event.target.value))
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
