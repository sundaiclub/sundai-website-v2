'use client';

import { useParams } from 'next/navigation';

import { useEffect, useState } from 'react';
import {
  ManagementAlert,
  ManagementBadge,
  useManagementClasses,
} from '../../../../components/ManagementSurface';
import { useEventWorkspace } from '../WorkspaceShell';
import JudgesManager from './JudgesManager';
import JudgingResultsView from './JudgingResultsView';
import JudgingAssignmentsView from './JudgingAssignmentsView';
import JudgingSetupEditor from './JudgingSetupEditor';
import type { EventJudgingConfig } from '@/types/judging';

type JudgingView = 'setup' | 'judges' | 'assignments' | 'results';

const views: Array<{ id: JudgingView; label: string }> = [
  { id: 'setup', label: 'Setup' },
  { id: 'judges', label: 'Judges' },
  { id: 'assignments', label: 'Assignments' },
  { id: 'results', label: 'Results' },
];

export default function OrganizerEventJudgingPage() {
  const params = useParams<{ eventId: string }>();
  const classes = useManagementClasses();
  const { capabilities } = useEventWorkspace();
  const [config, setConfig] = useState<EventJudgingConfig | null>(null);
  const [error, setError] = useState('');
  const [view, setView] = useState<JudgingView>('setup');
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState('');

  async function downloadJudging() {
    setDownloading(true);
    setDownloadError('');
    try {
      const response = await fetch(
        `/api/events/${params.eventId}/judging/export`,
        {
          cache: 'no-store',
        }
      );
      if (!response.ok) throw new Error('Download failed');
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download =
        response.headers
          .get('Content-Disposition')
          ?.match(/filename="([^"]+)"/)?.[1] ?? 'judging-results.xlsx';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setDownloadError('Could not download judging results. Please try again.');
    } finally {
      setDownloading(false);
    }
  }

  useEffect(() => {
    let current = true;
    fetch(`/api/events/${params.eventId}/judging`, { cache: 'no-store' })
      .then(async response => {
        if (!response.ok) throw new Error();
        return (await response.json()) as EventJudgingConfig;
      })
      .then(payload => {
        if (current) setConfig(payload);
      })
      .catch(() => {
        if (current) setError('Unable to load judging.');
      });
    return () => {
      current = false;
    };
  }, [params.eventId]);

  if (!capabilities.manageJudging) {
    return (
      <ManagementAlert tone="danger">
        <span role="alert">Only MCs and admins can manage judging.</span>
      </ManagementAlert>
    );
  }
  if (error) {
    return (
      <ManagementAlert tone="danger">
        <span role="alert">{error}</span>
      </ManagementAlert>
    );
  }
  if (!config) {
    return (
      <ManagementAlert>
        <span role="status">Loading judging…</span>
      </ManagementAlert>
    );
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          aria-label="Judging sections"
          className="flex flex-wrap gap-2"
          role="tablist"
        >
          {views.map(item => (
            <button
              aria-selected={view === item.id}
              className={
                view === item.id
                  ? classes.primaryButton
                  : classes.secondaryButton
              }
              key={item.id}
              onClick={() => setView(item.id)}
              role="tab"
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className={classes.secondaryButton}
            disabled={downloading}
            onClick={downloadJudging}
            type="button"
          >
            {downloading
              ? 'Downloading judging results…'
              : 'Download judging results'}
          </button>
          <ManagementBadge tone={config.judgingEnabled ? 'success' : 'default'}>
            {config.judgingEnabled ? 'Judging enabled' : 'Judging off'}
          </ManagementBadge>
          {config.judgingEnabled && (
            <ManagementBadge tone={config.judgingOpen ? 'success' : 'warning'}>
              {config.judgingOpen ? 'Scoring open' : 'Scoring closed'}
            </ManagementBadge>
          )}
        </div>
      </div>

      {downloadError && (
        <ManagementAlert tone="danger">
          <span role="alert">{downloadError}</span>
        </ManagementAlert>
      )}

      {view === 'setup' && (
        <JudgingSetupEditor
          config={config}
          eventId={params.eventId}
          onSaved={setConfig}
        />
      )}
      {view === 'judges' && (
        <JudgesManager
          config={config}
          eventId={params.eventId}
          onChanged={setConfig}
        />
      )}
      {view === 'assignments' && (
        <JudgingAssignmentsView eventId={params.eventId} />
      )}
      {view === 'results' && <JudgingResultsView eventId={params.eventId} />}
    </div>
  );
}
