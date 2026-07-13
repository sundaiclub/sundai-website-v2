'use client';

import { useEffect, useState } from 'react';
import {
  ManagementAlert,
  ManagementBadge,
  ManagementEmptyState,
  ManagementSection,
  useManagementClasses,
} from '../../../../components/ManagementSurface';
import type {
  EventMaterial,
  EventMaterialUploadIntent,
  EventMaterialVisibility,
} from '@/types/event-workspace';

type MaterialKind = 'LINK' | 'FILE';

const visibilityLabels: Record<EventMaterialVisibility, string> = {
  PUBLIC: 'Public',
  APPROVED_ATTENDEES: 'Approved attendees',
  ORGANIZERS_ONLY: 'Organizers only',
};

function sortMaterials(materials: EventMaterial[]) {
  return [...materials].sort(
    (left, right) =>
      left.position - right.position || left.title.localeCompare(right.title)
  );
}

export default function EventMaterialsPanel({ eventId }: { eventId: string }) {
  const classes = useManagementClasses();
  const [materials, setMaterials] = useState<EventMaterial[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [showEditor, setShowEditor] = useState(false);
  const [kind, setKind] = useState<MaterialKind>('LINK');
  const [title, setTitle] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  const [visibility, setVisibility] =
    useState<EventMaterialVisibility>('PUBLIC');
  const [position, setPosition] = useState('0');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    let isCurrent = true;
    setState('loading');

    fetch(`/api/events/${eventId}/materials`)
      .then(async response => {
        if (!response.ok) throw new Error('Unable to load materials');
        return response.json() as Promise<EventMaterial[]>;
      })
      .then(payload => {
        if (!isCurrent) return;
        setMaterials(sortMaterials(payload));
        setState('ready');
      })
      .catch(() => {
        if (isCurrent) setState('error');
      });

    return () => {
      isCurrent = false;
    };
  }, [eventId]);

  function resetEditor() {
    setShowEditor(false);
    setKind('LINK');
    setTitle('');
    setExternalUrl('');
    setVisibility('PUBLIC');
    setPosition('0');
    setFile(null);
    setActionError('');
  }

  async function createMaterial() {
    setSaving(true);
    setActionError('');

    try {
      let body:
        | {
            kind: 'LINK';
            title: string;
            externalUrl: string;
            visibility: EventMaterialVisibility;
            position: number;
          }
        | {
            kind: 'FILE';
            title: string;
            uploadToken: string;
            visibility: EventMaterialVisibility;
            position: number;
          };

      if (kind === 'FILE') {
        if (!file) throw new Error('Choose a file before uploading.');
        const intentResponse = await fetch(
          `/api/events/${eventId}/materials/upload-intents`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              filename: file.name,
              mimeType: file.type,
              size: file.size,
            }),
          }
        );
        if (!intentResponse.ok)
          throw new Error('Unable to prepare the upload.');
        const intent =
          (await intentResponse.json()) as EventMaterialUploadIntent;
        const uploadResponse = await fetch(intent.uploadUrl, {
          method: 'PUT',
          headers: { 'content-type': file.type },
          body: file,
        });
        if (!uploadResponse.ok) throw new Error('The file upload failed.');
        body = {
          kind: 'FILE',
          title: title.trim(),
          uploadToken: intent.uploadToken,
          visibility,
          position: Number(position),
        };
      } else {
        body = {
          kind: 'LINK',
          title: title.trim(),
          externalUrl: externalUrl.trim(),
          visibility,
          position: Number(position),
        };
      }

      const response = await fetch(`/api/events/${eventId}/materials`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error('Unable to create the material.');
      const created = (await response.json()) as EventMaterial;
      setMaterials(current => sortMaterials([...current, created]));
      resetEditor();
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : 'Unable to create the material.'
      );
    } finally {
      setSaving(false);
    }
  }

  async function moveMaterial(material: EventMaterial, direction: -1 | 1) {
    const nextPosition = material.position + direction;
    const response = await fetch(
      `/api/events/${eventId}/materials/${material.id}`,
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ position: nextPosition }),
      }
    );
    if (!response.ok) {
      setActionError('Unable to reorder the material.');
      return;
    }
    setMaterials(current =>
      sortMaterials(
        current.map(item =>
          item.id === material.id ? { ...item, position: nextPosition } : item
        )
      )
    );
  }

  async function removeMaterial(material: EventMaterial) {
    if (!window.confirm(`Delete ${material.title}? This cannot be undone.`)) {
      return;
    }
    const response = await fetch(
      `/api/events/${eventId}/materials/${material.id}`,
      { method: 'DELETE' }
    );
    if (!response.ok) {
      setActionError('Unable to delete the material.');
      return;
    }
    setMaterials(current => current.filter(item => item.id !== material.id));
  }

  async function toggleAvailability(material: EventMaterial) {
    const isAvailable = !material.isAvailable;
    const response = await fetch(
      `/api/events/${eventId}/materials/${material.id}`,
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ isAvailable }),
      }
    );
    if (!response.ok) {
      setActionError('Unable to update material availability.');
      return;
    }
    setMaterials(current =>
      current.map(item =>
        item.id === material.id ? { ...item, isAvailable } : item
      )
    );
  }

  if (state === 'loading') {
    return (
      <ManagementAlert>
        <span role="status">Loading event materials…</span>
      </ManagementAlert>
    );
  }

  if (state === 'error') {
    return (
      <ManagementAlert tone="danger">
        <span role="alert">Event materials are unavailable.</span>
      </ManagementAlert>
    );
  }

  return (
    <div className="space-y-5">
      <ManagementSection
        title="Materials"
        description="Share links and private files with the appropriate event audience."
        actions={
          <button
            className={classes.primaryButton}
            onClick={() => setShowEditor(true)}
            type="button"
          >
            Add material
          </button>
        }
      >
        <div className={`${classes.subtlePanel} mb-5 p-4`}>
          <h3 className="font-bold">File upload policy</h3>
          <p className={`mt-1 text-sm ${classes.mutedText}`}>
            Maximum 25 MiB. Supported files: PDF, plain text, Markdown, CSV,
            PNG, JPEG, WebP, GIF, DOCX, XLSX, and PPTX. Active content,
            archives, and executables are not accepted.
          </p>
        </div>

        {actionError && (
          <ManagementAlert tone="danger">
            <span role="alert">{actionError}</span>
          </ManagementAlert>
        )}

        {showEditor && (
          <div className={`${classes.subtlePanel} mb-5 space-y-4 p-4`}>
            <fieldset>
              <legend className="mb-2 font-bold">Material type</legend>
              <div className="flex gap-5">
                <label className="flex items-center gap-2">
                  <input
                    checked={kind === 'LINK'}
                    name="material-kind"
                    onChange={() => setKind('LINK')}
                    type="radio"
                  />
                  Link
                </label>
                <label className="flex items-center gap-2">
                  <input
                    checked={kind === 'FILE'}
                    name="material-kind"
                    onChange={() => setKind('FILE')}
                    type="radio"
                  />
                  File
                </label>
              </div>
            </fieldset>

            <label className="block">
              <span className="mb-1 block text-sm font-bold">Title</span>
              <input
                className={classes.input}
                onChange={event => setTitle(event.target.value)}
                required
                value={title}
              />
            </label>

            {kind === 'LINK' ? (
              <label className="block">
                <span className="mb-1 block text-sm font-bold">
                  HTTPS link URL
                </span>
                <input
                  className={classes.input}
                  onChange={event => setExternalUrl(event.target.value)}
                  required
                  type="url"
                  value={externalUrl}
                />
              </label>
            ) : (
              <label className="block">
                <span className="mb-1 block text-sm font-bold">
                  File upload
                </span>
                <input
                  accept=".pdf,.txt,.md,.csv,.png,.jpg,.jpeg,.webp,.gif,.docx,.xlsx,.pptx"
                  onChange={event => setFile(event.target.files?.[0] ?? null)}
                  type="file"
                />
              </label>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm font-bold">Visibility</span>
                <select
                  className={classes.input}
                  onChange={event =>
                    setVisibility(event.target.value as EventMaterialVisibility)
                  }
                  value={visibility}
                >
                  {Object.entries(visibilityLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-bold">
                  Display order
                </span>
                <input
                  className={classes.input}
                  min="0"
                  onChange={event => setPosition(event.target.value)}
                  type="number"
                  value={position}
                />
              </label>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                className={classes.primaryButton}
                disabled={saving || !title.trim() || (kind === 'FILE' && !file)}
                onClick={createMaterial}
                type="button"
              >
                {kind === 'FILE' ? 'Upload and create' : 'Create material'}
              </button>
              <button
                className={classes.secondaryButton}
                disabled={saving}
                onClick={resetEditor}
                type="button"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {materials.length === 0 ? (
          <ManagementEmptyState>
            No materials have been added yet.
          </ManagementEmptyState>
        ) : (
          <ol className="space-y-3">
            {materials.map((material, index) => (
              <li className={`${classes.subtlePanel} p-4`} key={material.id}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold">{material.title}</h3>
                      <ManagementBadge>
                        {visibilityLabels[material.visibility]}
                      </ManagementBadge>
                      <ManagementBadge>
                        {material.isAvailable ? 'Available' : 'Unavailable'}
                      </ManagementBadge>
                    </div>
                    <p className={`mt-1 text-sm ${classes.mutedText}`}>
                      {material.kind === 'FILE'
                        ? material.originalFilename
                        : material.externalUrl}
                    </p>
                    {material.description && (
                      <p className={`mt-1 text-sm ${classes.mutedText}`}>
                        {material.description}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      aria-label={`${
                        material.isAvailable ? 'Make' : 'Mark'
                      } ${material.title} ${
                        material.isAvailable ? 'unavailable' : 'available'
                      }`}
                      className={classes.secondaryButton}
                      onClick={() => toggleAvailability(material)}
                      type="button"
                    >
                      {material.isAvailable
                        ? 'Make unavailable'
                        : 'Make available'}
                    </button>
                    <button
                      aria-label={`Move ${material.title} up`}
                      className={classes.secondaryButton}
                      disabled={index === 0}
                      onClick={() => moveMaterial(material, -1)}
                      type="button"
                    >
                      Move up
                    </button>
                    <button
                      aria-label={`Move ${material.title} down`}
                      className={classes.secondaryButton}
                      disabled={index === materials.length - 1}
                      onClick={() => moveMaterial(material, 1)}
                      type="button"
                    >
                      Move down
                    </button>
                    <button
                      aria-label={`Delete ${material.title}`}
                      className={`${classes.secondaryButton} text-red-700`}
                      onClick={() => removeMaterial(material)}
                      type="button"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </ManagementSection>
    </div>
  );
}
