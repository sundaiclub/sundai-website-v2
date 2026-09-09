'use client';

import { ApplicationFieldInput } from './ApplicationFieldInput';
import type { TemplateFieldDefinition } from '@/types/event-management';
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
          <ApplicationFieldInput key={field.id} field={field} disabled />
        ))}
      </div>
    </div>
  );
}
