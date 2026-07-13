'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  ManagementAlert,
  ManagementBadge,
  ManagementEmptyState,
  ManagementSection,
  useManagementClasses,
} from '../../../../components/ManagementSurface';
import type { EventProjectCardStatus } from '@/types/event-workspace';

type Person = { id: string; name: string };
type WorkspaceProject = {
  id?: string;
  pitchProjectId?: string;
  cardStatus: EventProjectCardStatus;
  project: {
    id: string;
    title: string;
    preview?: string | null;
    description?: string | null;
    launchLead: Person;
    participants?: Person[];
    team?: Person[];
    techTags?: Array<{ id: string; name: string }>;
    domainTags?: Array<{ id: string; name: string }>;
    tags?: string[];
    githubUrl?: string | null;
    demoUrl?: string | null;
    blogUrl?: string | null;
    links?: {
      github?: string | null;
      demo?: string | null;
      blog?: string | null;
    };
  };
  queue: { status: string; position: number };
  pitch?: { phase?: string; isTopProject?: boolean };
  pitched?: boolean;
  isTopProject?: boolean;
  isHighlighted?: boolean;
  pitchResults?: unknown;
};

const cardStatuses: Array<{
  value: EventProjectCardStatus;
  label: string;
}> = [
  { value: 'DRAFT', label: 'Draft' },
  { value: 'NEEDS_INFO', label: 'Needs info' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'APPROVED', label: 'Approved' },
];

function entryId(entry: WorkspaceProject) {
  return entry.pitchProjectId ?? entry.id!;
}

export default function OrganizerEventProjectsPage({
  params,
}: {
  params: { eventId: string };
}) {
  const classes = useManagementClasses();
  const [projects, setProjects] = useState<WorkspaceProject[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let current = true;
    fetch(`/api/events/${params.eventId}/projects`)
      .then(async response => {
        if (!response.ok) throw new Error('Unable to load projects');
        return response.json();
      })
      .then(payload => {
        if (!current) return;
        setProjects(Array.isArray(payload) ? payload : (payload.items ?? []));
        setState('ready');
      })
      .catch(() => {
        if (current) setState('error');
      });
    return () => {
      current = false;
    };
  }, [params.eventId]);

  async function updateCardStatus(
    entry: WorkspaceProject,
    cardStatus: EventProjectCardStatus
  ) {
    setNotice('');
    const response = await fetch(
      `/api/events/${params.eventId}/projects/${entryId(entry)}`,
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ cardStatus }),
      }
    );
    if (!response.ok) {
      setNotice('Unable to update card status.');
      return;
    }
    setProjects(current =>
      current.map(project =>
        entryId(project) === entryId(entry)
          ? { ...project, cardStatus }
          : project
      )
    );
    setNotice('Card status updated.');
  }

  if (state === 'loading') {
    return <ManagementAlert>Loading event projects…</ManagementAlert>;
  }
  if (state === 'error') {
    return (
      <ManagementAlert tone="danger">
        Event projects are unavailable or permission was lost.
      </ManagementAlert>
    );
  }

  return (
    <ManagementSection
      title="Projects"
      description="Global project identity with card, queue, and pitch state for this event."
    >
      <ManagementAlert>
        Card status supports reporting readiness only. It does not block
        pitching, queue access, or voting.
      </ManagementAlert>
      {notice && (
        <div className="mt-4">
          <ManagementAlert
            tone={notice.startsWith('Unable') ? 'danger' : 'success'}
          >
            <span role="status">{notice}</span>
          </ManagementAlert>
        </div>
      )}

      <div className="mt-5 grid gap-4">
        {projects.map(entry => {
          const team = entry.project.team ?? entry.project.participants ?? [];
          const tags =
            entry.project.tags ??
            [
              ...(entry.project.techTags ?? []),
              ...(entry.project.domainTags ?? []),
            ].map(tag => tag.name);
          const links = {
            demo: entry.project.links?.demo ?? entry.project.demoUrl,
            github: entry.project.links?.github ?? entry.project.githubUrl,
            blog: entry.project.links?.blog ?? entry.project.blogUrl,
          };
          const pitched =
            entry.pitched ??
            (entry.pitch?.phase === 'COMPLETED' ||
              entry.queue.status === 'DONE');
          const highlighted =
            entry.isHighlighted ??
            entry.isTopProject ??
            entry.pitch?.isTopProject ??
            false;

          return (
            <article
              className={`${classes.subtlePanel} p-4`}
              key={entryId(entry)}
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:justify-between">
                <div className="min-w-0">
                  <h2 className="text-lg font-bold">
                    <Link
                      className="underline underline-offset-4 hover:no-underline"
                      href={`/projects/${entry.project.id}`}
                    >
                      {entry.project.title}
                    </Link>
                  </h2>
                  {(entry.project.preview || entry.project.description) && (
                    <p className={`mt-2 text-sm ${classes.mutedText}`}>
                      {entry.project.preview ?? entry.project.description}
                    </p>
                  )}
                  <p className="mt-2 text-sm font-semibold">
                    Launch lead: {entry.project.launchLead.name}
                  </p>
                  {team.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {team.map(person => (
                        <ManagementBadge key={person.id}>
                          {person.name}
                        </ManagementBadge>
                      ))}
                    </div>
                  )}
                  {tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {tags.map(tag => (
                        <ManagementBadge key={tag}>{tag}</ManagementBadge>
                      ))}
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap gap-3 text-sm">
                    {links.demo && <a href={links.demo}>Demo</a>}
                    {links.github && <a href={links.github}>GitHub</a>}
                    {links.blog && <a href={links.blog}>Blog / write-up</a>}
                  </div>
                </div>

                <div className="grid min-w-56 gap-3 text-sm">
                  <label>
                    <span className="mb-1 block font-bold">Card status</span>
                    <select
                      aria-label={`Card status for ${entry.project.title}`}
                      className={classes.input}
                      onChange={event =>
                        updateCardStatus(
                          entry,
                          event.target.value as EventProjectCardStatus
                        )
                      }
                      value={entry.cardStatus}
                    >
                      {cardStatuses.map(status => (
                        <option key={status.value} value={status.value}>
                          {status.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p>
                    <span className="font-bold">Queue:</span>{' '}
                    {entry.queue.status} · Position {entry.queue.position}
                  </p>
                  <p>{pitched ? 'Pitched' : 'Not yet pitched'}</p>
                  <p>{highlighted ? 'Highlighted' : 'Not highlighted'}</p>
                </div>
              </div>
            </article>
          );
        })}
        {projects.length === 0 && (
          <ManagementEmptyState>
            No projects are linked to this event yet.
          </ManagementEmptyState>
        )}
      </div>
    </ManagementSection>
  );
}
