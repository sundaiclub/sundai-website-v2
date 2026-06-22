'use client';

import type {
  TemplateFieldDefinition,
  TemplateFieldOption,
} from '@/types/event-management';
import {
  ManagementBadge,
  ManagementEmptyState,
  useManagementClasses,
} from './ManagementSurface';

function sortedFields(fields: TemplateFieldDefinition[]) {
  return [...fields].sort((left, right) => {
    const leftOrder = left.order ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = right.order ?? Number.MAX_SAFE_INTEGER;
    return leftOrder - rightOrder;
  });
}

function optionLabel(options: TemplateFieldOption[] | undefined) {
  return options?.[0]?.label ?? 'Select an option';
}

function PreviewControl({ field }: { field: TemplateFieldDefinition }) {
  const classes = useManagementClasses();
  const label = (
    <span className="text-sm font-semibold">
      {field.label}
      {field.required && <span aria-hidden="true"> *</span>}
    </span>
  );

  if (field.type === 'TEXTAREA') {
    return (
      <label className="block">
        {label}
        <textarea
          className={`${classes.textarea} mt-2 block w-full`}
          disabled
          placeholder={field.placeholder ?? ''}
        />
      </label>
    );
  }

  if (field.type === 'BOOLEAN') {
    return (
      <label className="flex items-start gap-3">
        <input
          className={`${classes.checkbox} mt-1`}
          disabled
          type="checkbox"
        />
        <span>
          {label}
          {field.helpText && (
            <span className={`block text-sm ${classes.mutedText}`}>
              {field.helpText}
            </span>
          )}
        </span>
      </label>
    );
  }

  if (field.type === 'SELECT' || field.type === 'MULTI_SELECT') {
    return (
      <label className="block">
        {label}
        <select className={`${classes.input} mt-2 block w-full`} disabled>
          <option>{optionLabel(field.options)}</option>
        </select>
      </label>
    );
  }

  const inputType =
    field.type === 'EMAIL'
      ? 'email'
      : field.type === 'PHONE'
        ? 'tel'
        : field.type === 'URL'
          ? 'url'
          : field.type === 'NUMBER'
            ? 'number'
            : field.type === 'DATE'
              ? 'date'
              : field.type === 'DATETIME'
                ? 'datetime-local'
                : 'text';

  return (
    <label className="block">
      {label}
      <input
        className={`${classes.input} mt-2 block w-full`}
        disabled
        placeholder={field.placeholder ?? ''}
        type={inputType}
      />
      {field.helpText && (
        <span className={`mt-1 block text-sm ${classes.mutedText}`}>
          {field.helpText}
        </span>
      )}
    </label>
  );
}

export function ApplicationTemplatePreview({
  fields,
  title = 'Application preview',
}: {
  fields: TemplateFieldDefinition[];
  title?: string;
}) {
  const classes = useManagementClasses();
  const visibleFields = sortedFields(fields);

  if (visibleFields.length === 0) {
    return (
      <ManagementEmptyState>
        No active site template fields are available to preview.
      </ManagementEmptyState>
    );
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-bold">{title}</h3>
        <ManagementBadge>Read-only</ManagementBadge>
      </div>
      <div className={`${classes.subtlePanel} grid gap-4 p-4`}>
        {visibleFields.map(field => (
          <PreviewControl key={field.id} field={field} />
        ))}
      </div>
    </div>
  );
}
