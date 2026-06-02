'use client';

import { useEffect, useState } from 'react';
import AdminAuthGate from '../AdminAuthGate';
import {
  ManagementAlert,
  ManagementBackButton,
  ManagementEmptyState,
  ManagementHeader,
  ManagementPage,
  ManagementSection,
} from '../../components/ManagementSurface';
import { ApplicationTemplateEditor } from '../../components/ApplicationTemplateEditor';
import { ApplicationTemplatePreview } from '../../components/ApplicationTemplatePreview';
import { useUserContext } from '../../contexts/UserContext';
import type {
  ApplicationTemplateListItem,
  TemplateFieldDefinition,
} from '@/types/event-management';

function templateList(payload: unknown): ApplicationTemplateListItem[] {
  const templates = Array.isArray(payload)
    ? (payload as ApplicationTemplateListItem[])
    : payload && typeof payload === 'object'
      ? ((
          payload as {
            templates?: ApplicationTemplateListItem[];
            items?: ApplicationTemplateListItem[];
          }
        ).templates ??
        (
          payload as {
            templates?: ApplicationTemplateListItem[];
            items?: ApplicationTemplateListItem[];
          }
        ).items ??
        [])
      : [];

  return templates.map(template => ({
    ...template,
    isActive:
      typeof template.isActive === 'boolean'
        ? template.isActive
        : (template as ApplicationTemplateListItem & { status?: string })
            .status === 'ACTIVE',
  }));
}

function replaceTemplate(
  templates: ApplicationTemplateListItem[],
  savedTemplate: ApplicationTemplateListItem
) {
  return templates.map(template =>
    template.id === savedTemplate.id
      ? {
          ...template,
          ...savedTemplate,
        }
      : savedTemplate.isActive &&
          template.scope === savedTemplate.scope &&
          (template.scope === 'SITE' ||
            template.chapterId === savedTemplate.chapterId)
        ? { ...template, isActive: false }
        : template
  );
}

function activeSiteTemplateCount(templates: ApplicationTemplateListItem[]) {
  return templates.filter(
    template => template.scope === 'SITE' && template.isActive
  ).length;
}

function activeSiteTemplateDescription(
  templates: ApplicationTemplateListItem[]
) {
  const count = activeSiteTemplateCount(templates);
  if (count === 1) {
    return 'The active site template is the base application for every chapter.';
  }
  if (count === 0) {
    return 'No active site template exists. Activate one site template before composing chapter applications.';
  }
  return 'Multiple active site templates are listed. Saving one as active will deactivate the others.';
}

function templateFields(
  template: ApplicationTemplateListItem | undefined
): TemplateFieldDefinition[] {
  const fields = (template?.fieldsJson ?? template?.fields ?? []) as Array<
    Partial<TemplateFieldDefinition> & { key?: string }
  >;

  return fields.map((field, index) => ({
    id:
      typeof field.id === 'string' && field.id.trim()
        ? field.id
        : typeof field.key === 'string' && field.key.trim()
          ? field.key
          : `field_${index + 1}`,
    label: field.label ?? '',
    type: field.type ?? 'TEXT',
    required: field.required ?? false,
    siteRequired: field.siteRequired,
    helpText: field.helpText,
    placeholder: field.placeholder,
    options: field.options,
    validation: field.validation,
    order: field.order ?? index,
  }));
}

export default function AdminApplicationTemplatesPage() {
  const { isAdmin, loading, userInfo } = useUserContext();
  const [templates, setTemplates] = useState<ApplicationTemplateListItem[]>([]);
  const [loadError, setLoadError] = useState('');
  const activeSiteTemplate = templates.find(
    template => template.scope === 'SITE' && template.isActive
  );

  useEffect(() => {
    if (!isAdmin) return;
    setLoadError('');
    fetch('/api/application-templates')
      .then(response => {
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        return response.json() as Promise<unknown>;
      })
      .then(payload => setTemplates(templateList(payload)))
      .catch(() => setLoadError('Unable to load application templates.'));
  }, [isAdmin]);

  return (
    <ManagementPage>
      <AdminAuthGate
        isAdmin={isAdmin}
        isAuthenticated={Boolean(userInfo)}
        loading={loading}
      >
        <>
          <div className="mb-4">
            <ManagementBackButton />
          </div>
          <ManagementHeader
            eyebrow="Site admin"
            title="Application templates"
            description={activeSiteTemplateDescription(templates)}
          />
          {loadError && (
            <div className="mb-5">
              <ManagementAlert tone="danger">{loadError}</ManagementAlert>
            </div>
          )}
          <ManagementSection
            title="Templates"
            description="Edit the active site template and chapter extensions. Site-required fields in the active site template cannot be removed by chapter or event questions."
          >
            <div className="grid gap-4">
              {templates.map(template => (
                <ApplicationTemplateEditor
                  key={template.id}
                  template={template}
                  onSaved={savedTemplate =>
                    setTemplates(current =>
                      replaceTemplate(current, savedTemplate)
                    )
                  }
                  onDeleted={templateId =>
                    setTemplates(current =>
                      current.filter(template => template.id !== templateId)
                    )
                  }
                />
              ))}
              {templates.length === 0 && (
                <ManagementEmptyState>
                  No templates have been created.
                </ManagementEmptyState>
              )}
            </div>
          </ManagementSection>
          <div className="mt-5">
            <ManagementSection
              title="Application preview"
              description="Preview of the active site template used as the base application for every chapter."
            >
              <ApplicationTemplatePreview
                title={activeSiteTemplate?.name ?? 'Active site application'}
                fields={templateFields(activeSiteTemplate)}
              />
            </ManagementSection>
          </div>
        </>
      </AdminAuthGate>
    </ManagementPage>
  );
}
