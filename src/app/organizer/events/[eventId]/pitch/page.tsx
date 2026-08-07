'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ManagementAlert,
  ManagementEmptyState,
  ManagementLinkButton,
  ManagementSection,
  useManagementClasses,
} from '../../../../components/ManagementSurface';

type PitchProject = {
  queue?: { status?: string; position?: number | null };
  pitch?: {
    phase?: string;
    sessionPhase?: string;
    completedAt?: string | null;
    isTopProject?: boolean;
  };
  pitched?: boolean;
  isHighlighted?: boolean;
};

function readable(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export default function OrganizerEventPitchPage({
  params,
}: {
  params: { eventId: string };
}) {
  const classes = useManagementClasses();
  const [projects, setProjects] = useState<PitchProject[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'unavailable'>(
    'loading'
  );

  useEffect(() => {
    let isCurrent = true;
    setState('loading');

    fetch(`/api/events/${params.eventId}/projects`)
      .then(async response => {
        if (!response.ok) throw new Error('Unable to load pitch summary.');
        return response.json() as Promise<unknown>;
      })
      .then(payload => {
        if (!isCurrent) return;
        const value = payload as { items?: unknown };
        const items = Array.isArray(payload)
          ? payload
          : Array.isArray(value?.items)
            ? value.items
            : [];
        setProjects(items as PitchProject[]);
        setState('ready');
      })
      .catch(() => {
        if (isCurrent) setState('unavailable');
      });

    return () => {
      isCurrent = false;
    };
  }, [params.eventId]);

  const summary = useMemo(() => {
    const queuedStatuses = new Set(['QUEUED', 'APPROVED', 'CURRENT']);
    const queued = projects.filter(project =>
      queuedStatuses.has(project.queue?.status ?? '')
    ).length;
    const pitched = projects.filter(
      project =>
        project.pitched === true ||
        project.queue?.status === 'DONE' ||
        Boolean(project.pitch?.completedAt)
    ).length;
    const highlighted = projects.filter(
      project =>
        project.isHighlighted === true || project.pitch?.isTopProject === true
    ).length;
    const phases = Array.from(
      new Set(
        projects
          .map(project => project.pitch?.sessionPhase)
          .filter((phase): phase is string => Boolean(phase))
      )
    );
    return { queued, pitched, highlighted, phases };
  }, [projects]);

  if (state === 'loading') {
    return (
      <ManagementAlert>
        <span role="status">Loading pitch data…</span>
      </ManagementAlert>
    );
  }

  if (state === 'unavailable') {
    return (
      <ManagementAlert tone="danger">
        <span role="alert">Pitch summary is unavailable.</span>
      </ManagementAlert>
    );
  }

  return (
    <ManagementSection
      title="Pitch summary"
      description="Review event pitch state here, then open the focused controller to operate the live session."
      actions={
        <ManagementLinkButton
          href={`/pitch/${params.eventId}`}
          variant="primary"
        >
          Open pitch controller
        </ManagementLinkButton>
      }
    >
      {projects.length === 0 ? (
        <ManagementEmptyState>
          No projects are currently in this event&apos;s pitch sessions.
        </ManagementEmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className={`${classes.subtlePanel} p-4`}>
            <div className="text-2xl font-bold">{summary.queued}</div>
            <div className={`mt-1 text-sm ${classes.mutedText}`}>
              {summary.queued} queued
            </div>
          </div>
          <div className={`${classes.subtlePanel} p-4`}>
            <div className="text-2xl font-bold">{summary.pitched}</div>
            <div className={`mt-1 text-sm ${classes.mutedText}`}>
              {summary.pitched} pitched
            </div>
          </div>
          <div className={`${classes.subtlePanel} p-4`}>
            <div className="text-2xl font-bold">{summary.highlighted}</div>
            <div className={`mt-1 text-sm ${classes.mutedText}`}>
              {summary.highlighted} highlighted
            </div>
          </div>
          <div className={`${classes.subtlePanel} p-4`}>
            <div className="font-bold">Session phase</div>
            <div className={`mt-1 text-sm ${classes.mutedText}`}>
              {summary.phases.length > 0
                ? summary.phases.map(readable).join(', ')
                : 'Not started'}
            </div>
          </div>
        </div>
      )}
      <p className={`mt-4 text-sm ${classes.mutedText}`}>
        Timer and live session controls remain in the focused pitch controller.
      </p>
    </ManagementSection>
  );
}
