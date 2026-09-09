'use client';

import { useId } from 'react';
import type {
  JsonValue,
  TemplateFieldDefinition,
} from '@/types/event-management';
import { useManagementClasses } from './ManagementSurface';

export function ApplicationChoiceField({
  field,
  value,
  onChange,
  error,
  disabled = false,
}: {
  field: TemplateFieldDefinition;
  value?: JsonValue;
  onChange?: (value: JsonValue) => void;
  error?: string;
  disabled?: boolean;
}) {
  const classes = useManagementClasses();
  const id = useId();
  const multiple = field.type === 'MULTI_SELECT';
  const selected = multiple
    ? Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string')
      : []
    : typeof value === 'string'
      ? [value]
      : [];

  return (
    <fieldset
      className="grid gap-1"
      disabled={disabled}
      aria-describedby={`${id}-help${error ? ` ${id}-error` : ''}`}
      aria-invalid={Boolean(error)}
    >
      <legend className="text-sm font-semibold">
        {field.label}
        {field.required && <span aria-hidden="true"> *</span>}
      </legend>
      <p id={`${id}-help`} className={`text-xs ${classes.mutedText}`}>
        {multiple ? 'Select all that apply.' : 'Select one option.'}
        {field.required && ' Required.'}
        {field.helpText && ` ${field.helpText}`}
      </p>
      {(field.options ?? []).map(option => (
        <label
          key={option.value}
          className="flex min-h-6 items-center gap-2 text-sm"
        >
          <input
            className={classes.checkbox}
            type="checkbox"
            checked={selected.includes(option.value)}
            onChange={event =>
              onChange?.(
                multiple
                  ? event.target.checked
                    ? [...selected, option.value]
                    : selected.filter(item => item !== option.value)
                  : event.target.checked
                    ? option.value
                    : ''
              )
            }
          />
          {option.label}
        </label>
      ))}
      {error && (
        <p id={`${id}-error`} className="text-sm text-red-600">
          {error}
        </p>
      )}
    </fieldset>
  );
}
