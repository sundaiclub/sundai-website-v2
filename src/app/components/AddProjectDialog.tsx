'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useManagementClasses } from './ManagementSurface';

type ProjectOption = {
  id: string;
  title: string;
  preview?: string | null;
  startDate: string | Date;
  eventAdded: boolean;
  pitchAdded: boolean;
};

export function AddProjectDialog({
  eventId,
  eventTitle,
  open,
  onClose,
  onProjectAdded,
  returnTo,
}: {
  eventId: string;
  eventTitle: string;
  open: boolean;
  onClose: () => void;
  onProjectAdded?: () => void | Promise<void>;
  returnTo?: string;
}) {
  const classes = useManagementClasses();
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadProjects = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(
        `/api/events/${eventId}/pitch/project-options`
      );
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.message || 'Unable to load your projects.');
      }
      setProjects(body.projects || []);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Unable to load your projects.'
      );
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (!open) return;
    setSelectedProjectId('');
    setSearchTerm('');
    setMessage('');
    setError('');
    void loadProjects();
  }, [loadProjects, open]);

  const filteredProjects = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return projects;
    return projects.filter(
      project =>
        project.title.toLowerCase().includes(query) ||
        (project.preview || '').toLowerCase().includes(query)
    );
  }, [projects, searchTerm]);

  async function addProject() {
    if (!selectedProjectId) return;
    setAdding(true);
    setMessage('');
    setError('');
    try {
      const response = await fetch(`/api/events/${eventId}/pitch/queue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: selectedProjectId }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(body?.message || 'Unable to add this project.');
      }

      setMessage('Successfully added to the event and pitch queue.');
      setSelectedProjectId('');
      await loadProjects();
      await onProjectAdded?.();
    } catch (addError) {
      setError(
        addError instanceof Error
          ? addError.message
          : 'Unable to add this project.'
      );
    } finally {
      setAdding(false);
    }
  }

  if (!open) return null;

  const newProjectHref = `/projects/new?${new URLSearchParams({
    sourceEventId: eventId,
    returnTo: returnTo ?? `/pitch/${eventId}`,
  }).toString()}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-project-title"
    >
      <div
        className={`${classes.panel} ${classes.isDarkMode ? '!bg-gray-900' : '!bg-white'} w-full max-w-lg p-6`}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="add-project-title" className="text-xl font-bold">
              Add a project
            </h2>
            <p className={`mt-1 text-sm ${classes.mutedText}`}>{eventTitle}</p>
          </div>
          <button
            className={classes.ghostButton}
            onClick={onClose}
            type="button"
          >
            Close
          </button>
        </div>

        {message && (
          <div
            className="mt-4 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900"
            role="status"
          >
            {message}
          </div>
        )}
        {error && (
          <div
            className="mt-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900"
            role="alert"
          >
            {error}
          </div>
        )}

        <Link
          className={`${classes.primaryButton} mt-5 w-full`}
          href={newProjectHref}
        >
          New project
        </Link>

        <div className="my-5 flex items-center gap-3" aria-hidden="true">
          <div className="h-px flex-1 bg-gray-300" />
          <span className={`text-xs font-bold uppercase ${classes.mutedText}`}>
            Add existing project
          </span>
          <div className="h-px flex-1 bg-gray-300" />
        </div>

        {loading ? (
          <p className={classes.mutedText}>Loading projects...</p>
        ) : projects.length === 0 ? (
          <p className={classes.mutedText}>You have no published projects.</p>
        ) : (
          <>
            <input
              aria-label="Search your projects"
              className={`${classes.input} mb-3 w-full`}
              onChange={event => setSearchTerm(event.target.value)}
              placeholder="Search your projects..."
              value={searchTerm}
            />
            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {filteredProjects.map(project => (
                <label
                  className={`${classes.subtlePanel} flex items-start gap-3 p-3 ${
                    project.pitchAdded ? 'opacity-70' : 'cursor-pointer'
                  }`}
                  key={project.id}
                >
                  <input
                    checked={selectedProjectId === project.id}
                    className="mt-1"
                    disabled={project.pitchAdded}
                    name="project"
                    onChange={() => setSelectedProjectId(project.id)}
                    type="radio"
                    value={project.id}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate font-semibold">
                        {project.title}
                      </span>
                      {project.pitchAdded && (
                        <span className="shrink-0 text-xs font-bold text-emerald-600">
                          Already added
                        </span>
                      )}
                    </span>
                    {project.preview && (
                      <span
                        className={`block truncate text-xs ${classes.mutedText}`}
                      >
                        {project.preview}
                      </span>
                    )}
                    {project.eventAdded && !project.pitchAdded && (
                      <span
                        className={`mt-1 block text-xs ${classes.mutedText}`}
                      >
                        Already part of this event
                      </span>
                    )}
                  </span>
                </label>
              ))}
              {filteredProjects.length === 0 && (
                <p className={`py-3 text-sm ${classes.mutedText}`}>
                  No results.
                </p>
              )}
            </div>
          </>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            className={classes.secondaryButton}
            onClick={onClose}
            type="button"
          >
            Cancel
          </button>
          <button
            className={classes.primaryButton}
            disabled={!selectedProjectId || adding}
            onClick={addProject}
            type="button"
          >
            {adding ? 'Adding...' : 'Add project'}
          </button>
        </div>
      </div>
    </div>
  );
}
