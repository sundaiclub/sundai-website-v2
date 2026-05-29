'use client';

import { useEffect, useState } from 'react';
import AdminAuthGate from '../AdminAuthGate';
import {
  ManagementBadge,
  ManagementEmptyState,
  ManagementHeader,
  ManagementPage,
  ManagementSection,
  useManagementClasses,
} from '../../components/ManagementSurface';
import { useUserContext } from '../../contexts/UserContext';

type Template = {
  id: string;
  name: string;
  scope: string;
  isActive: boolean;
  fields?: Array<{ id?: string; key?: string; label: string }>;
};

const defaultSiteFields = [
  {
    id: 'name',
    label: 'Name',
    type: 'TEXT',
    required: true,
    siteRequired: true,
  },
  {
    id: 'email',
    label: 'Email',
    type: 'EMAIL',
    required: true,
    siteRequired: true,
  },
];

function templateList(payload: unknown): Template[] {
  if (Array.isArray(payload)) return payload as Template[];
  if (payload && typeof payload === 'object') {
    const value = payload as { templates?: Template[]; items?: Template[] };
    return value.templates ?? value.items ?? [];
  }
  return [];
}

export default function AdminApplicationTemplatesPage() {
  const classes = useManagementClasses();
  const { isAdmin, loading } = useUserContext();
  const [templates, setTemplates] = useState<Template[]>([]);

  useEffect(() => {
    if (!isAdmin) return;
    fetch('/api/application-templates')
      .then(response => (response.ok ? response.json() : []))
      .then(payload => setTemplates(templateList(payload)))
      .catch(() => setTemplates([]));
  }, [isAdmin]);

  async function createDefaultSiteTemplate() {
    const response = await fetch('/api/application-templates', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        scope: 'SITE',
        name: 'Default site application',
        fieldsJson: defaultSiteFields,
      }),
    });
    if (response.ok) {
      const created = await response.json();
      setTemplates(current => [...current, created]);
    }
  }

  return (
    <ManagementPage>
      <AdminAuthGate isAdmin={isAdmin} loading={loading}>
        <>
          <ManagementHeader
            eyebrow="Site admin"
            title="Application templates"
            description="Manage site and chapter application questions used by event registrations."
            actions={
              <button
                className={classes.primaryButton}
                onClick={createDefaultSiteTemplate}
                type="button"
              >
                Create site template
              </button>
            }
          />
          <ManagementSection title="Templates">
            <div className={`divide-y ${classes.divider}`}>
              {templates.map(template => (
                <div
                  key={template.id}
                  className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                >
                  <div className="min-w-0">
                    <div className="font-semibold">{template.name}</div>
                    <div className={`mt-1 text-sm ${classes.mutedText}`}>
                      {(template.fields ?? [])
                        .map(field => field.label)
                        .join(', ') || 'No fields configured'}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <ManagementBadge>{template.scope}</ManagementBadge>
                    <ManagementBadge
                      tone={template.isActive ? 'success' : 'default'}
                    >
                      {template.isActive ? 'ACTIVE' : 'INACTIVE'}
                    </ManagementBadge>
                  </div>
                </div>
              ))}
              {templates.length === 0 && (
                <ManagementEmptyState>
                  No templates have been created.
                </ManagementEmptyState>
              )}
            </div>
          </ManagementSection>
          <div className="mt-5">
            <ManagementSection title="Preview merged application">
              <ManagementEmptyState>
                Select a chapter or event scope to preview merged fields.
              </ManagementEmptyState>
            </ManagementSection>
          </div>
        </>
      </AdminAuthGate>
    </ManagementPage>
  );
}
