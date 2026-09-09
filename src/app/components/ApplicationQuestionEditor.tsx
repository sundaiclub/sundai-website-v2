'use client';
import { useEffect, useId, useRef, useState } from 'react';
import type {
  TemplateFieldDefinition,
  TemplateFieldOption,
  TemplateFieldType,
} from '@/types/event-management';
import {
  TEMPLATE_FIELD_TYPES,
  applicationQuestionTypeLabel,
  applicationQuestionOptionsError,
} from '@/lib/applicationTemplates';
import { useManagementClasses } from './ManagementSurface';
function optionText(options?: TemplateFieldOption[]) {
  return (options ?? [])
    .map(option => `${option.label}=${option.value}`)
    .join('\n');
}

function parseOptions(value: string): TemplateFieldOption[] | undefined {
  const options = value
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const separatorIndex = line.indexOf('=');
      if (separatorIndex < 0) {
        return { label: line, value: line };
      }

      return {
        label: line.slice(0, separatorIndex).trim(),
        value: line.slice(separatorIndex + 1).trim(),
      };
    });

  return options.length > 0 ? options : undefined;
}

export function ApplicationQuestionEditor({
  field,
  onChange,
  labelPrefix,
  disabled = false,
  allowSiteRequired = false,
}: {
  field: TemplateFieldDefinition;
  onChange: (updates: Partial<TemplateFieldDefinition>) => void;
  labelPrefix: string;
  disabled?: boolean;
  allowSiteRequired?: boolean;
}) {
  const classes = useManagementClasses();
  const optionsHelpId = useId();
  const supportsOptions =
    field.type === 'SELECT' || field.type === 'MULTI_SELECT';
  const [optionsText, setOptionsText] = useState(() =>
    optionText(field.options)
  );
  const lastOptions = useRef(field.options);
  useEffect(() => {
    if (lastOptions.current !== field.options) {
      lastOptions.current = field.options;
      setOptionsText(optionText(field.options));
    }
  }, [field.options]);
  const optionsError = applicationQuestionOptionsError(field);
  return (
    <div className="grid gap-3">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)]">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide">
            Label
          </span>
          <input
            aria-label={`${labelPrefix} label`}
            className={`${classes.input} mt-1 w-full`}
            disabled={disabled}
            value={field.label}
            onChange={event => onChange({ label: event.target.value })}
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide">
            Type
          </span>
          <select
            aria-label={`${labelPrefix} type`}
            className={`${classes.input} mt-1 w-full`}
            disabled={disabled}
            value={field.type}
            onChange={event =>
              onChange({
                type: event.target.value as TemplateFieldType,
                options:
                  event.target.value === 'SELECT' ||
                  event.target.value === 'MULTI_SELECT'
                    ? field.options
                    : undefined,
              })
            }
          >
            {TEMPLATE_FIELD_TYPES.map(type => (
              <option key={type} value={type}>
                {applicationQuestionTypeLabel(type)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-start">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide">
            Placeholder
          </span>
          <input
            aria-label={`${labelPrefix} placeholder`}
            className={`${classes.input} mt-1 w-full`}
            disabled={disabled}
            value={field.placeholder ?? ''}
            onChange={event => onChange({ placeholder: event.target.value })}
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide">
            Help text
          </span>
          <input
            aria-label={`${labelPrefix} help text`}
            className={`${classes.input} mt-1 w-full`}
            disabled={disabled}
            value={field.helpText ?? ''}
            onChange={event => onChange({ helpText: event.target.value })}
          />
        </label>
        <div className="flex flex-wrap gap-4 pt-1 md:pt-7">
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              className={classes.checkbox}
              aria-label={`${labelPrefix} required`}
              checked={field.required}
              disabled={disabled}
              type="checkbox"
              onChange={event => onChange({ required: event.target.checked })}
            />
            Required
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              aria-label={`${labelPrefix} reuse previous answer`}
              className={classes.checkbox}
              checked={field.reusePreviousAnswer === true}
              disabled={disabled}
              type="checkbox"
              onChange={event =>
                onChange({
                  reusePreviousAnswer: event.target.checked,
                })
              }
            />
            Reuse previous answer
          </label>
          {allowSiteRequired && (
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input
                className={classes.checkbox}
                checked={field.siteRequired === true}
                disabled={disabled}
                type="checkbox"
                onChange={event =>
                  onChange({
                    siteRequired: event.target.checked,
                    required: event.target.checked ? true : field.required,
                  })
                }
              />
              Site required
            </label>
          )}
        </div>
      </div>

      {supportsOptions && (
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide">
            Options (one per line)
          </span>
          <textarea
            aria-label={`${labelPrefix} options`}
            aria-describedby={optionsHelpId}
            aria-invalid={Boolean(optionsError)}
            className={`${classes.textarea} mt-1 block min-h-24 w-full`}
            disabled={disabled}
            value={optionsText}
            onChange={event => {
              const options = parseOptions(event.target.value);
              lastOptions.current = options;
              setOptionsText(event.target.value);
              onChange({ options });
            }}
          />
        </label>
      )}

      {supportsOptions && (
        <p id={optionsHelpId} className={classes.mutedText}>
          {optionsError ?? 'Enter one option per line.'}
        </p>
      )}
    </div>
  );
}
