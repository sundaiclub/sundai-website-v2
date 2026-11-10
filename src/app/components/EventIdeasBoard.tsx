'use client';

import { useEffect, useState, type FormEvent } from 'react';
import {
  EVENT_IDEA_LIMITS,
  EVENT_IDEAS_REFRESH_MS,
  type PublicEventIdea,
} from '@/types/event-ideas';
import {
  ManagementAlert,
  ManagementEmptyState,
  ManagementSection,
  useManagementClasses,
} from './ManagementSurface';

async function responseMessage(response: Response, fallback: string) {
  const body = await response.json().catch(() => null);
  return typeof body?.message === 'string' ? body.message : fallback;
}

function IdeaDialog({
  eventId,
  viewerName,
  editing,
  onClose,
  onSaved,
}: {
  eventId: string;
  viewerName: string | null;
  editing: PublicEventIdea | null;
  onClose: () => void;
  onSaved: (idea: PublicEventIdea) => void;
}) {
  const classes = useManagementClasses();
  const [name, setName] = useState(editing?.name ?? viewerName ?? '');
  const [idea, setIdea] = useState(editing?.idea ?? '');
  const [description, setDescription] = useState(editing?.description ?? '');
  const failureMessage = editing
    ? 'Could not save your idea'
    : 'Could not add your idea';
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    function closeOnEscape(keyEvent: KeyboardEvent) {
      if (keyEvent.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  async function submit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    setIsSubmitting(true);
    setError('');
    try {
      const response = await fetch(
        editing
          ? `/api/events/${eventId}/ideas/${editing.id}`
          : `/api/events/${eventId}/ideas`,
        {
          method: editing ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, idea, description }),
        }
      );
      if (!response.ok) {
        setError(await responseMessage(response, failureMessage));
        return;
      }
      onSaved(await response.json());
    } catch {
      setError(failureMessage);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      aria-labelledby="idea-dialog-title"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onMouseDown={event => {
        if (event.currentTarget === event.target) onClose();
      }}
      role="dialog"
    >
      <div
        className={`${classes.panel} max-h-[90vh] w-full max-w-xl overflow-y-auto p-5 sm:p-7`}
        style={{ backgroundColor: classes.isDarkMode ? '#111827' : '#ffffff' }}
      >
        <div className="mb-6 flex items-start justify-between gap-4">
          <h2 className="text-2xl font-bold" id="idea-dialog-title">
            {editing ? 'Edit your idea' : 'Add an idea'}
          </h2>
          <button
            aria-label="Close"
            className={classes.ghostButton}
            onClick={onClose}
            type="button"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>
        <form className="grid gap-4" onSubmit={submit}>
          <label className="grid gap-1 text-sm font-semibold">
            Name
            <input
              autoFocus={!editing && !viewerName}
              className={classes.input}
              maxLength={EVENT_IDEA_LIMITS.name}
              onChange={event => setName(event.target.value)}
              required
              value={name}
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            Idea
            <input
              autoFocus={Boolean(editing || viewerName)}
              className={classes.input}
              maxLength={EVENT_IDEA_LIMITS.idea}
              onChange={event => setIdea(event.target.value)}
              placeholder="One sentence about your project"
              required
              value={idea}
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold">
            <span>
              Description{' '}
              <span className={`font-normal ${classes.mutedText}`}>
                (optional)
              </span>
            </span>
            <textarea
              className={classes.textarea}
              maxLength={EVENT_IDEA_LIMITS.description}
              onChange={event => setDescription(event.target.value)}
              placeholder="More detail on what you want to build"
              value={description}
            />
          </label>
          {error && <ManagementAlert tone="danger">{error}</ManagementAlert>}
          <div className="flex justify-end gap-2">
            <button
              className={classes.secondaryButton}
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
            <button
              className={classes.primaryButton}
              disabled={isSubmitting || !name.trim() || !idea.trim()}
              type="submit"
            >
              {editing
                ? isSubmitting
                  ? 'Saving...'
                  : 'Save idea'
                : isSubmitting
                  ? 'Adding...'
                  : 'Add idea'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function EventIdeasBoard({
  eventId,
  timezone,
  viewerName,
  initialIdeas,
}: {
  eventId: string;
  timezone: string;
  viewerName: string | null;
  initialIdeas: PublicEventIdea[];
}) {
  const classes = useManagementClasses();
  const [ideas, setIdeas] = useState(initialIdeas);
  const [dialog, setDialog] = useState<{
    editing: PublicEventIdea | null;
  } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const showActions = ideas.some(idea => idea.canEdit || idea.canDelete);

  useEffect(() => {
    let cancelled = false;
    async function refresh() {
      try {
        const response = await fetch(`/api/events/${eventId}/ideas`, {
          cache: 'no-store',
        });
        if (!response.ok) return;
        const body = (await response.json()) as { ideas: PublicEventIdea[] };
        if (!cancelled) setIdeas(body.ideas);
      } catch {
        // Keep showing the last ideas; the next refresh will try again.
      }
    }
    const handle = setInterval(refresh, EVENT_IDEAS_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(handle);
    };
  }, [eventId]);

  async function deleteIdea(idea: PublicEventIdea) {
    if (!window.confirm(`Delete "${idea.idea}"? This cannot be undone.`)) {
      return;
    }
    setDeletingId(idea.id);
    setDeleteError('');
    try {
      const response = await fetch(`/api/events/${eventId}/ideas/${idea.id}`, {
        method: 'DELETE',
      });
      if (!response.ok && response.status !== 404) {
        setDeleteError(
          await responseMessage(response, 'Could not delete the idea')
        );
        return;
      }
      setIdeas(current => current.filter(existing => existing.id !== idea.id));
    } catch {
      setDeleteError('Could not delete the idea');
    } finally {
      setDeletingId(null);
    }
  }

  const timeFormat = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: timezone,
  });

  return (
    <ManagementSection
      actions={
        <button
          aria-haspopup="dialog"
          className={classes.primaryButton}
          onClick={() => setDialog({ editing: null })}
          type="button"
        >
          Add idea
        </button>
      }
      description="Share what you want to build today and find people to build it with."
      title="Ideas"
    >
      {deleteError && (
        <div className="mb-4">
          <ManagementAlert tone="danger">{deleteError}</ManagementAlert>
        </div>
      )}
      {ideas.length === 0 ? (
        <ManagementEmptyState>
          No ideas yet. Be the first to add one.
        </ManagementEmptyState>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead
              className={`border-b text-xs uppercase ${classes.mutedText}`}
            >
              <tr>
                <th className="px-3 py-2 font-semibold" scope="col">
                  Name
                </th>
                <th className="px-3 py-2 font-semibold" scope="col">
                  Idea
                </th>
                <th className="px-3 py-2 font-semibold" scope="col">
                  Description
                </th>
                <th className="px-3 py-2 font-semibold" scope="col">
                  Added
                </th>
                {showActions && (
                  <th className="px-3 py-2 font-semibold" scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody className={`divide-y ${classes.divider}`}>
              {ideas.map(idea => (
                <tr className="align-top" key={idea.id}>
                  <td className="whitespace-nowrap px-3 py-3 font-semibold">
                    {idea.name}
                  </td>
                  <td className="px-3 py-3 font-semibold">{idea.idea}</td>
                  <td
                    className={`whitespace-pre-wrap break-words px-3 py-3 ${classes.mutedText}`}
                  >
                    {idea.description}
                  </td>
                  <td
                    className={`whitespace-nowrap px-3 py-3 ${classes.mutedText}`}
                  >
                    {timeFormat.format(new Date(idea.createdAt))}
                  </td>
                  {showActions && (
                    <td className="whitespace-nowrap px-3 py-2 text-right">
                      {idea.canEdit && (
                        <button
                          aria-label={`Edit ${idea.idea}`}
                          className={classes.ghostButton}
                          onClick={() => setDialog({ editing: idea })}
                          type="button"
                        >
                          Edit
                        </button>
                      )}
                      {idea.canDelete && (
                        <button
                          aria-label={`Delete ${idea.idea}`}
                          className={`${classes.ghostButton} ${
                            classes.isDarkMode ? 'text-red-300' : 'text-red-700'
                          }`}
                          disabled={deletingId === idea.id}
                          onClick={() => void deleteIdea(idea)}
                          type="button"
                        >
                          {deletingId === idea.id ? 'Deleting...' : 'Delete'}
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {dialog && (
        <IdeaDialog
          editing={dialog.editing}
          eventId={eventId}
          onClose={() => setDialog(null)}
          onSaved={idea => {
            setIdeas(current =>
              current.some(existing => existing.id === idea.id)
                ? current.map(existing =>
                    existing.id === idea.id ? idea : existing
                  )
                : [idea, ...current]
            );
            setDialog(null);
          }}
          viewerName={viewerName}
        />
      )}
    </ManagementSection>
  );
}
