'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { v4 as uuidv4 } from 'uuid';
import type {
  ApplicationTemplateListItem,
  TemplateFieldDefinition,
  TemplateFieldOption,
  TemplateFieldType,
} from '@/types/event-management';
import {
  ManagementAlert,
  ManagementBadge,
  useManagementClasses,
} from './ManagementSurface';

const FIELD_TYPES: TemplateFieldType[] = [
  'TEXT',
  'TEXTAREA',
  'EMAIL',
  'PHONE',
  'URL',
  'NUMBER',
  'CHECKBOX',
  'SELECT',
  'MULTI_SELECT',
  'DATE',
  'DATETIME',
];

type EditableTemplate = ApplicationTemplateListItem & {
  fieldsJson?: TemplateFieldDefinition[];
};

function isFieldType(value: unknown): value is TemplateFieldType {
  return (
    typeof value === 'string' &&
    FIELD_TYPES.includes(value as TemplateFieldType)
  );
}

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
    })
    .filter(option => option.label && option.value);

  return options.length > 0 ? options : undefined;
}

function templateFields(template: EditableTemplate): TemplateFieldDefinition[] {
  const rawFields = (template.fieldsJson ?? template.fields ?? []) as Array<
    Partial<TemplateFieldDefinition> & { key?: string }
  >;

  return rawFields.map((field, index) => ({
    id:
      typeof field.id === 'string' && field.id.trim()
        ? field.id
        : typeof field.key === 'string' && field.key.trim()
          ? field.key
          : `field_${index + 1}`,
    label: typeof field.label === 'string' ? field.label : '',
    type: isFieldType(field.type) ? field.type : 'TEXT',
    required: typeof field.required === 'boolean' ? field.required : false,
    reusePreviousAnswer: field.reusePreviousAnswer === true,
    siteRequired:
      template.scope === 'SITE' && typeof field.siteRequired === 'boolean'
        ? field.siteRequired
        : undefined,
    helpText: typeof field.helpText === 'string' ? field.helpText : null,
    placeholder:
      typeof field.placeholder === 'string' ? field.placeholder : null,
    options: Array.isArray(field.options) ? field.options : undefined,
    validation: field.validation,
    order: index,
  }));
}

function newField(
  scope: EditableTemplate['scope'],
  index: number
): TemplateFieldDefinition {
  return {
    id: `question_${uuidv4()}`,
    label: '',
    type: 'TEXT',
    required: false,
    reusePreviousAnswer: false,
    siteRequired: scope === 'SITE' ? false : undefined,
    order: index,
  };
}

function fieldsForSave(
  fields: TemplateFieldDefinition[],
  scope: EditableTemplate['scope']
) {
  return fields.map((field, index) => {
    const nextField: TemplateFieldDefinition = {
      id: field.id.trim(),
      label: field.label.trim(),
      type: field.type,
      required: field.required,
      reusePreviousAnswer: field.reusePreviousAnswer === true,
      order: index,
    };

    if (scope === 'SITE') {
      nextField.siteRequired = field.siteRequired === true;
    }

    if (field.helpText?.trim()) nextField.helpText = field.helpText.trim();
    if (field.placeholder?.trim()) {
      nextField.placeholder = field.placeholder.trim();
    }
    if (
      (field.type === 'SELECT' || field.type === 'MULTI_SELECT') &&
      field.options?.length
    ) {
      nextField.options = field.options;
    }

    return nextField;
  });
}

export function ApplicationTemplateEditor({
  template,
  canEdit = true,
  onSaved,
  onDeleted,
}: {
  template: EditableTemplate;
  canEdit?: boolean;
  onSaved?: (template: ApplicationTemplateListItem) => void;
  onDeleted?: (templateId: string) => void;
}) {
  const classes = useManagementClasses();
  const [name, setName] = useState(template.name);
  const [fields, setFields] = useState<TemplateFieldDefinition[]>(() =>
    templateFields(template)
  );
  const [isActive, setIsActive] = useState(template.isActive);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const canDelete =
    canEdit && !(template.scope === 'SITE' && template.isActive);

  useEffect(() => {
    setName(template.name);
    setFields(templateFields(template));
    setIsActive(template.isActive);
    setStatusMessage('');
    setErrorMessage('');
  }, [template]);

  function updateField(
    index: number,
    updates: Partial<TemplateFieldDefinition>
  ) {
    setFields(current =>
      current.map((field, fieldIndex) =>
        fieldIndex === index ? { ...field, ...updates } : field
      )
    );
  }

  function addField() {
    setFields(current => [
      ...current,
      newField(template.scope, current.length),
    ]);
  }

  function removeField(index: number) {
    setFields(current =>
      current.filter((_, fieldIndex) => fieldIndex !== index)
    );
  }

  async function saveTemplate(event: FormEvent) {
    event.preventDefault();
    if (!canEdit) return;

    setIsSaving(true);
    setStatusMessage('');
    setErrorMessage('');

    try {
      const response = await fetch(
        `/api/application-templates/${template.id}`,
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            name,
            isActive,
            fieldsJson: fieldsForSave(fields, template.scope),
          }),
        }
      );

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(
          payload?.message ||
            payload?.issues
              ?.map((issue: { message: string }) => issue.message)
              .join(' ') ||
            `Template update failed with status ${response.status}`
        );
      }

      const saved = await response.json();
      onSaved?.(saved);
      setFields(templateFields(saved));
      setStatusMessage('Template saved.');
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to save template.'
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteTemplate() {
    if (!canDelete) return;

    setIsDeleting(true);
    setStatusMessage('');
    setErrorMessage('');

    try {
      const response = await fetch(
        `/api/application-templates/${template.id}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(
          payload?.message ||
            `Template delete failed with status ${response.status}`
        );
      }

      onDeleted?.(template.id);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Unable to delete template.'
      );
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <form onSubmit={saveTemplate} className={`${classes.subtlePanel} p-4`}>
      <div className="mb-4">
        <h3 className="text-lg font-bold">{template.name}</h3>
        <div className={`mt-1 text-sm ${classes.mutedText}`}>
          {fields.map(field => field.label || 'Untitled field').join(', ') ||
            'No fields configured'}
        </div>
      </div>
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="min-w-0">
          <label className="block">
            <span className="text-sm font-semibold">Template name</span>
            <input
              aria-label={`${template.name} template name`}
              className={`${classes.input} mt-2 w-full`}
              disabled={!canEdit}
              value={name}
              onChange={event => setName(event.target.value)}
            />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <ManagementBadge>{template.scope}</ManagementBadge>
            {template.chapter?.name && (
              <ManagementBadge>{template.chapter.name}</ManagementBadge>
            )}
            <ManagementBadge tone={isActive ? 'success' : 'default'}>
              {isActive ? 'ACTIVE' : 'INACTIVE'}
            </ManagementBadge>
          </div>
        </div>
        <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
          <input
            className={classes.checkbox}
            checked={isActive}
            disabled={!canEdit}
            type="checkbox"
            onChange={event => setIsActive(event.target.checked)}
          />
          Active
        </label>
      </div>

      <div className="mt-5 grid gap-3">
        {fields.map((field, index) => {
          const supportsOptions =
            field.type === 'SELECT' || field.type === 'MULTI_SELECT';

          return (
            <div
              key={`${field.id}-${index}`}
              className={`grid gap-3 border-t pt-4 ${classes.isDarkMode ? 'border-gray-800' : 'border-gray-200'}`}
            >
              <div className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)]">
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide">
                    Label
                  </span>
                  <input
                    aria-label={`${template.name} field ${index + 1} label`}
                    className={`${classes.input} mt-1 w-full`}
                    disabled={!canEdit}
                    value={field.label}
                    onChange={event =>
                      updateField(index, { label: event.target.value })
                    }
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide">
                    Type
                  </span>
                  <select
                    aria-label={`${template.name} field ${index + 1} type`}
                    className={`${classes.input} mt-1 w-full`}
                    disabled={!canEdit}
                    value={field.type}
                    onChange={event =>
                      updateField(index, {
                        type: event.target.value as TemplateFieldType,
                        options:
                          event.target.value === 'SELECT' ||
                          event.target.value === 'MULTI_SELECT'
                            ? field.options
                            : undefined,
                      })
                    }
                  >
                    {FIELD_TYPES.map(type => (
                      <option key={type} value={type}>
                        {type}
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
                    aria-label={`${template.name} field ${index + 1} placeholder`}
                    className={`${classes.input} mt-1 w-full`}
                    disabled={!canEdit}
                    value={field.placeholder ?? ''}
                    onChange={event =>
                      updateField(index, { placeholder: event.target.value })
                    }
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide">
                    Help text
                  </span>
                  <input
                    aria-label={`${template.name} field ${index + 1} help text`}
                    className={`${classes.input} mt-1 w-full`}
                    disabled={!canEdit}
                    value={field.helpText ?? ''}
                    onChange={event =>
                      updateField(index, { helpText: event.target.value })
                    }
                  />
                </label>
                <div className="flex flex-wrap gap-4 pt-1 md:pt-7">
                  <label className="flex items-center gap-2 text-sm font-semibold">
                    <input
                      className={classes.checkbox}
                      checked={field.required}
                      disabled={!canEdit}
                      type="checkbox"
                      onChange={event =>
                        updateField(index, { required: event.target.checked })
                      }
                    />
                    Required
                  </label>
                  <label className="flex items-center gap-2 text-sm font-semibold">
                    <input
                      aria-label={`${template.name} field ${index + 1} reuse previous answer`}
                      className={classes.checkbox}
                      checked={field.reusePreviousAnswer === true}
                      disabled={!canEdit}
                      type="checkbox"
                      onChange={event =>
                        updateField(index, {
                          reusePreviousAnswer: event.target.checked,
                        })
                      }
                    />
                    Reuse previous answer
                  </label>
                  {template.scope === 'SITE' && (
                    <label className="flex items-center gap-2 text-sm font-semibold">
                      <input
                        className={classes.checkbox}
                        checked={field.siteRequired === true}
                        disabled={!canEdit}
                        type="checkbox"
                        onChange={event =>
                          updateField(index, {
                            siteRequired: event.target.checked,
                            required: event.target.checked
                              ? true
                              : field.required,
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
                    Options
                  </span>
                  <textarea
                    aria-label={`${template.name} field ${index + 1} options`}
                    className={`${classes.textarea} mt-1 block min-h-24 w-full`}
                    disabled={!canEdit}
                    value={optionText(field.options)}
                    onChange={event =>
                      updateField(index, {
                        options: parseOptions(event.target.value),
                      })
                    }
                  />
                </label>
              )}

              <div>
                <button
                  className={classes.ghostButton}
                  disabled={!canEdit}
                  type="button"
                  onClick={() => removeField(index)}
                >
                  <TrashIcon className="h-4 w-4" aria-hidden="true" />
                  Remove field
                </button>
              </div>
            </div>
          );
        })}

        {fields.length === 0 && (
          <div className={`text-sm ${classes.mutedText}`}>
            No fields are configured.
          </div>
        )}
      </div>

      {errorMessage && (
        <div className="mt-4">
          <ManagementAlert tone="danger">{errorMessage}</ManagementAlert>
        </div>
      )}
      {statusMessage && (
        <div className="mt-4">
          <ManagementAlert tone="success">{statusMessage}</ManagementAlert>
        </div>
      )}

      {canEdit && (
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            className={classes.secondaryButton}
            type="button"
            onClick={addField}
          >
            <PlusIcon className="h-4 w-4" aria-hidden="true" />
            Add field
          </button>
          <button
            className={classes.primaryButton}
            disabled={isSaving || !name.trim()}
            type="submit"
          >
            {isSaving ? 'Saving...' : 'Save template'}
          </button>
          <button
            className={classes.secondaryButton}
            disabled={!canDelete || isDeleting}
            type="button"
            onClick={deleteTemplate}
          >
            <TrashIcon className="h-4 w-4" aria-hidden="true" />
            {isDeleting ? 'Deleting...' : 'Delete template'}
          </button>
        </div>
      )}
    </form>
  );
}
