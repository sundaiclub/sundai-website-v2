'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type {
  ChapterEngagement,
  EventEngagementReport,
} from '@/types/event-engagement';
import AdminAuthGate from '../AdminAuthGate';
import {
  ManagementAlert,
  ManagementBackButton,
  ManagementBadge,
  ManagementEmptyState,
  ManagementHeader,
  ManagementPage,
  ManagementSection,
  useManagementClasses,
} from '../../components/ManagementSurface';
import { useUserContext } from '../../contexts/UserContext';

function formatRate(rate: number | null) {
  return rate === null ? '—' : `${Math.round(rate * 100)}%`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function LastWeekSummary({ chapters }: { chapters: ChapterEngagement[] }) {
  const classes = useManagementClasses();
  const items = chapters.flatMap(chapter =>
    chapter.events
      .filter(event => event.isLastWeek)
      .map(event => ({ chapter, event }))
  );

  return (
    <ManagementSection
      title="Last week"
      description="Hacks that started in the past seven days, compared with the rest of their chapter."
    >
      {items.length === 0 ? (
        <ManagementEmptyState>
          No hacks shown here started in the past seven days.
        </ManagementEmptyState>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {items.map(({ chapter, event }) => (
            <div key={event.eventId} className={`${classes.subtlePanel} p-4`}>
              <div
                className={`text-xs font-bold uppercase tracking-wide ${classes.mutedText}`}
              >
                {chapter.chapterName}
              </div>
              <Link
                className="mt-1 block font-semibold underline-offset-2 hover:underline"
                href={`/organizer/events/${event.eventId}`}
              >
                {event.title}
              </Link>
              <div className="mt-3 text-3xl font-bold">
                {formatRate(event.builtRate)}
              </div>
              <p className={`mt-1 text-sm ${classes.mutedText}`}>
                {event.rsvpBuilders} of {event.rsvps} RSVPs built a project
                {event.rank !== null &&
                  ` · #${event.rank} of ${chapter.rankedEvents} in chapter`}
                {` · chapter average ${formatRate(chapter.builtRate)}`}
              </p>
            </div>
          ))}
        </div>
      )}
    </ManagementSection>
  );
}

function ChapterTable({ chapter }: { chapter: ChapterEngagement }) {
  const classes = useManagementClasses();
  const highlight = classes.isDarkMode ? 'bg-emerald-950/40' : 'bg-emerald-50';

  return (
    <ManagementSection
      title={chapter.chapterName}
      description={`${formatRate(chapter.builtRate)} of RSVPs built a project across ${chapter.rankedEvents} ranked ${chapter.rankedEvents === 1 ? 'hack' : 'hacks'}.`}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className={classes.mutedText}>
            <tr>
              <th className="px-2 py-2">#</th>
              <th className="px-2 py-2">Hack</th>
              <th className="px-2 py-2">Date</th>
              <th className="px-2 py-2 text-right">RSVPs</th>
              <th className="px-2 py-2 text-right">Projects</th>
              <th className="px-2 py-2 text-right">Presented</th>
              <th className="px-2 py-2 text-right">RSVP&apos;d &amp; built</th>
              <th className="px-2 py-2 text-right">% built</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${classes.divider}`}>
            {chapter.events.map(event => (
              <tr
                key={event.eventId}
                className={event.isLastWeek ? highlight : undefined}
              >
                <td className="px-2 py-2 font-bold">{event.rank ?? '—'}</td>
                <td className="px-2 py-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      className="font-semibold underline-offset-2 hover:underline"
                      href={`/organizer/events/${event.eventId}`}
                    >
                      {event.title}
                    </Link>
                    {event.isLastWeek && (
                      <ManagementBadge tone="success">
                        Last week
                      </ManagementBadge>
                    )}
                    {event.builtRate === null && (
                      <ManagementBadge>No projects on site</ManagementBadge>
                    )}
                  </div>
                </td>
                <td className="whitespace-nowrap px-2 py-2">
                  {formatDate(event.startTime)}
                </td>
                <td className="px-2 py-2 text-right">{event.rsvps}</td>
                <td className="px-2 py-2 text-right">{event.projects}</td>
                <td className="px-2 py-2 text-right">{event.presented}</td>
                <td className="px-2 py-2 text-right">{event.rsvpBuilders}</td>
                <td className="px-2 py-2 text-right font-bold">
                  {formatRate(event.builtRate)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ManagementSection>
  );
}

export default function AdminEventEngagementPage() {
  const { isAdmin, loading, userInfo } = useUserContext();
  const [report, setReport] = useState<EventEngagementReport | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAdmin) return;
    setError('');
    fetch('/api/admin/event-engagement')
      .then(response => {
        if (!response.ok) throw new Error(String(response.status));
        return response.json() as Promise<EventEngagementReport>;
      })
      .then(setReport)
      .catch(() => setError('Unable to load hack engagement.'));
  }, [isAdmin]);

  return (
    <ManagementPage maxWidth="max-w-7xl">
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
            title="Hack engagement"
            description={`The share of people who RSVP'd to a hack and ended up on a project submitted to it. Projects come from the event's pitch queue and published project cards.${report ? ` Only hacks with at least ${report.minRsvps} RSVPs on this site are shown.` : ''}`}
          />
          {error && <ManagementAlert tone="danger">{error}</ManagementAlert>}
          {report && (
            <div className="space-y-5">
              <LastWeekSummary chapters={report.chapters} />
              {report.chapters.length === 0 ? (
                <ManagementEmptyState>
                  No hacks have enough RSVPs to show yet.
                </ManagementEmptyState>
              ) : (
                report.chapters.map(chapter => (
                  <ChapterTable key={chapter.chapterId} chapter={chapter} />
                ))
              )}
            </div>
          )}
        </>
      </AdminAuthGate>
    </ManagementPage>
  );
}
