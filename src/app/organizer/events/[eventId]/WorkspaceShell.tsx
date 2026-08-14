'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  ManagementAlert,
  ManagementBadge,
  ManagementPage,
  useManagementClasses,
} from '../../../components/ManagementSurface';
import type {
  EventWorkspaceOverview,
  WorkspaceSection,
} from '@/types/event-workspace';

type EffectiveWorkspaceRole = 'SITE_ADMIN' | 'CHAPTER_ADMIN' | 'MC' | 'CO_MC';

export type EventWorkspacePayload = EventWorkspaceOverview & {
  effectiveRole?: EffectiveWorkspaceRole;
};

const EventWorkspaceContext = createContext<EventWorkspacePayload | null>(null);

export function useEventWorkspace() {
  const workspace = useContext(EventWorkspaceContext);
  if (!workspace) {
    throw new Error('useEventWorkspace must be used inside WorkspaceShell.');
  }
  return workspace;
}

type WorkspaceShellProps = {
  eventId: string;
  children: ReactNode;
  initialWorkspace?: EventWorkspacePayload | null;
};

const sections: Array<{
  id: WorkspaceSection;
  label: string;
  path: string;
}> = [
  { id: 'overview', label: 'Overview', path: '' },
  { id: 'registrations', label: 'RSVPs', path: '/registrations' },
  {
    id: 'communications',
    label: 'Communications',
    path: '/communications',
  },
  { id: 'materials', label: 'Materials', path: '/materials' },
  { id: 'projects', label: 'Projects', path: '/projects' },
  { id: 'pitch', label: 'Pitch', path: '/pitch' },
  { id: 'notes', label: 'Notes', path: '/notes' },
  { id: 'reporting', label: 'Reporting preview', path: '/reporting' },
];

function readableRole(role?: EffectiveWorkspaceRole) {
  if (role === 'SITE_ADMIN') return 'Site admin';
  if (role === 'CHAPTER_ADMIN') return 'Chapter admin';
  if (role === 'CO_MC') return 'Co-MC';
  if (role === 'MC') return 'MC';
  return 'Organizer';
}

function readableStatus(status: string) {
  return status
    .toLowerCase()
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function scheduleLabel(startTime: string, endTime: string, timezone: string) {
  const start = new Date(startTime);
  const end = new Date(endTime);
  if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf())) {
    return 'Schedule unavailable';
  }

  const date = start.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: timezone,
  });
  const startLabel = start.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone,
  });
  const endLabel = end.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone,
  });
  return `${date}, ${startLabel}–${endLabel}`;
}

export function WorkspaceLoading() {
  return (
    <ManagementPage maxWidth="max-w-7xl">
      <ManagementAlert>
        <span role="status">Loading event workspace…</span>
      </ManagementAlert>
    </ManagementPage>
  );
}

export function WorkspaceUnavailable({
  message = 'This event workspace is temporarily unavailable.',
}: {
  message?: string;
}) {
  return (
    <ManagementPage maxWidth="max-w-7xl">
      <ManagementAlert tone="danger">
        <span role="alert">{message}</span>
      </ManagementAlert>
    </ManagementPage>
  );
}

export function WorkspacePermissionLost() {
  return (
    <ManagementPage maxWidth="max-w-7xl">
      <ManagementAlert tone="danger">
        <span role="alert">
          You no longer have access to this event workspace. Your organizer
          permission may have been removed.
        </span>
      </ManagementAlert>
    </ManagementPage>
  );
}

function WorkspaceContent({
  children,
  eventId,
  workspace,
}: {
  children: ReactNode;
  eventId: string;
  workspace: EventWorkspacePayload;
}) {
  const pathname = usePathname();
  const classes = useManagementClasses();
  const event = workspace.event;
  const hasPublicEvent = event.status !== 'DRAFT';
  const availableSections = new Set(
    workspace.availableSections?.length
      ? workspace.availableSections
      : sections.map(section => section.id)
  );

  return (
    <ManagementPage maxWidth="max-w-7xl">
      {hasPublicEvent && (
        <div className="mb-4">
          <Link className={classes.ghostButton} href={event.publicUrl}>
            <span aria-hidden="true">&larr;</span>
            <span>Back to event</span>
          </Link>
        </div>
      )}
      <header className={`${classes.panel} mb-5 p-5 sm:p-6`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className={`text-sm font-semibold ${classes.mutedText}`}>
              {event.chapter.name}
            </p>
            <h1 className="mt-1 text-2xl font-bold sm:text-3xl">
              {event.title}
            </h1>
            <p className={`mt-2 text-sm ${classes.mutedText}`}>
              {scheduleLabel(event.startTime, event.endTime, event.timezone)}
            </p>
            <div
              className="mt-3 flex flex-wrap gap-2"
              aria-label="Event status"
            >
              <ManagementBadge>{readableStatus(event.status)}</ManagementBadge>
              <ManagementBadge>
                Role: {readableRole(workspace.effectiveRole)}
              </ManagementBadge>
            </div>
          </div>
          {hasPublicEvent && (
            <Link
              className={classes.secondaryButton}
              href={event.publicUrl}
              target="_blank"
            >
              View event
            </Link>
          )}
        </div>

        <nav aria-label="Event workspace" className="mt-5 overflow-x-auto">
          <ul className="flex min-w-max gap-1 border-b" role="list">
            {sections
              .filter(section => availableSections.has(section.id))
              .map(section => {
                const href = `/organizer/events/${eventId}${section.path}`;
                const isCurrent =
                  section.id === 'overview'
                    ? pathname === href
                    : pathname === href || pathname.startsWith(`${href}/`);
                return (
                  <li key={section.id}>
                    <Link
                      aria-current={isCurrent ? 'page' : undefined}
                      className={`block border-b-2 px-3 py-3 text-sm font-semibold outline-none focus-visible:ring-2 ${
                        isCurrent
                          ? 'border-current'
                          : 'border-transparent hover:border-current'
                      }`}
                      href={href}
                    >
                      {section.label}
                    </Link>
                  </li>
                );
              })}
          </ul>
        </nav>
      </header>
      <EventWorkspaceContext.Provider value={workspace}>
        {children}
      </EventWorkspaceContext.Provider>
    </ManagementPage>
  );
}

export default function WorkspaceShell({
  children,
  eventId,
  initialWorkspace,
}: WorkspaceShellProps) {
  const [workspace, setWorkspace] = useState<EventWorkspacePayload | null>(
    initialWorkspace ?? null
  );
  const [state, setState] = useState<
    'loading' | 'ready' | 'permission-lost' | 'unavailable'
  >(initialWorkspace ? 'ready' : 'loading');

  useEffect(() => {
    if (initialWorkspace) {
      setWorkspace(initialWorkspace);
      setState('ready');
      return;
    }

    let isCurrent = true;
    setState('loading');
    setWorkspace(null);

    fetch(`/api/events/${eventId}/workspace`)
      .then(async response => {
        if (response.status === 401 || response.status === 403) {
          if (isCurrent) setState('permission-lost');
          return null;
        }
        if (!response.ok) {
          if (isCurrent) setState('unavailable');
          return null;
        }
        return response.json() as Promise<EventWorkspacePayload>;
      })
      .then(payload => {
        if (!isCurrent || !payload) return;
        setWorkspace(payload);
        setState('ready');
      })
      .catch(() => {
        if (isCurrent) setState('unavailable');
      });

    return () => {
      isCurrent = false;
    };
  }, [eventId, initialWorkspace]);

  if (state === 'loading') return <WorkspaceLoading />;
  if (state === 'permission-lost') return <WorkspacePermissionLost />;
  if (state === 'unavailable' || !workspace) return <WorkspaceUnavailable />;

  return (
    <WorkspaceContent eventId={eventId} workspace={workspace}>
      {children}
    </WorkspaceContent>
  );
}
