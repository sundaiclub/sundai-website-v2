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

function AddIdeaDialog({
  eventId,
  viewerName,
  onClose,
  onCreated,
}: {
  eventId: string;
  viewerName: string | null;
  onClose: () => void;
  onCreated: (idea: PublicEventIdea) => void;
}) {
  const classes = useManagementClasses();
  const [name, setName] = useState(viewerName ?? '');
  const [idea, setIdea] = useState('');
  const [description, setDescription] = useState('');
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
      const response = await fetch(`/api/events/${eventId}/ideas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, idea, description }),
      });
      if (!response.ok) {
        setError(await responseMessage(response, 'Could not add your idea'));
        return;
      }
      onCreated(await response.json());
    } catch {
      setError('Could not add your idea');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      aria-labelledby="add-idea-dialog-title"
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
          <h2 className="text-2xl font-bold" id="add-idea-dialog-title">
            Add an idea
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
              autoFocus={!viewerName}
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
              autoFocus={Boolean(viewerName)}
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
              {isSubmitting ? 'Adding...' : 'Add idea'}
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
  const [isAdding, setIsAdding] = useState(false);

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
          onClick={() => setIsAdding(true)}
          type="button"
        >
          Add idea
        </button>
      }
      description="Share what you want to build today and find people to build it with."
      title="Ideas"
    >
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {isAdding && (
        <AddIdeaDialog
          eventId={eventId}
          onClose={() => setIsAdding(false)}
          onCreated={idea => {
            setIdeas(current => [
              idea,
              ...current.filter(existing => existing.id !== idea.id),
            ]);
            setIsAdding(false);
          }}
          viewerName={viewerName}
        />
      )}
    </ManagementSection>
  );
}
