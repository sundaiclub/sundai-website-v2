'use client';

import { useEffect, useState } from 'react';
import {
  ManagementAlert,
  ManagementEmptyState,
  ManagementSection,
  useManagementClasses,
} from '../../../../components/ManagementSurface';
import type { JudgingAssignmentPreview } from '@/types/judging';

export default function JudgingAssignmentsView({
  eventId,
}: {
  eventId: string;
}) {
  const classes = useManagementClasses();
  const [preview, setPreview] = useState<JudgingAssignmentPreview | null>(null);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let current = true;
    setLoading(true);
    fetch(`/api/events/${eventId}/judging/assignments`, { cache: 'no-store' })
      .then(async response => {
        const body = await response.json();
        if (!response.ok)
          throw new Error(body?.message || 'Unable to load assignments.');
        if (current) {
          setPreview(body);
          setError('');
        }
      })
      .catch(error => {
        if (current) setError(error.message || 'Unable to load assignments.');
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    const timer = window.setTimeout(
      () => setRefresh(value => value + 1),
      15000
    );
    return () => {
      current = false;
      window.clearTimeout(timer);
    };
  }, [eventId, refresh]);

  return (
    <div className="grid gap-5">
      <ManagementSection
        title={
          preview?.published ? 'Published assignments' : 'Draft assignments'
        }
        description={
          preview?.published
            ? 'Assignments stay fixed when scoring is closed and reopened.'
            : 'This preview uses saved projects, judges, and settings. It updates as judges are added. After submissions close, open scoring in Setup to publish the final assignments.'
        }
        actions={
          <button
            className={classes.secondaryButton}
            disabled={loading}
            onClick={() => setRefresh(value => value + 1)}
            type="button"
          >
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        }
      >
        {error && (
          <ManagementAlert tone="danger">
            <span role="alert">{error}</span>
          </ManagementAlert>
        )}
        {preview && (
          <div className="grid gap-4">
            <p>
              {preview.judgesPerProject} judges required per project.{' '}
              {preview.projects.length} projects. {preview.judges.length}{' '}
              judges.
            </p>
            {preview.shortages.map(track => (
              <ManagementAlert key={track.trackId} tone="warning">
                {track.trackName} needs {track.required} judges but has{' '}
                {track.eligible}. Add {track.required - track.eligible} more to
                cover every project.
              </ManagementAlert>
            ))}
            {!preview.published &&
              preview.projects.length > 0 &&
              preview.shortages.length === 0 && (
                <ManagementAlert tone="success">
                  Every project has enough judges in this draft.
                </ManagementAlert>
              )}
            {preview.judges.length === 0 ? (
              <ManagementEmptyState>
                Add judges to see their workloads.
              </ManagementEmptyState>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <caption className="sr-only">Projects per judge</caption>
                  <thead>
                    <tr>
                      <th className="p-2">Judge</th>
                      {preview.tracks.map(track => (
                        <th className="p-2" key={track.id}>
                          {track.name}
                        </th>
                      ))}
                      <th className="p-2">Total</th>
                    </tr>
                  </thead>
                  <tbody className={`divide-y ${classes.divider}`}>
                    {preview.judges.map(judge => (
                      <tr key={judge.id}>
                        <th className="p-2 font-medium" scope="row">
                          {judge.name}
                        </th>
                        {preview.tracks.map(track => (
                          <td className="p-2" key={track.id}>
                            {judge.trackCounts[track.id] ?? 0}
                          </td>
                        ))}
                        <td className="p-2 font-bold">{judge.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </ManagementSection>
      {preview && (
        <ManagementSection title="Project coverage">
          {preview.projects.length === 0 ? (
            <ManagementEmptyState>
              No projects are ready for judging yet.
            </ManagementEmptyState>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    <th className="p-2">Project</th>
                    <th className="p-2">Track</th>
                    <th className="p-2">Required</th>
                    <th className="p-2">Assigned</th>
                    <th className="p-2">Complete</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${classes.divider}`}>
                  {preview.projects.map(project => (
                    <tr key={project.id}>
                      <th scope="row" className="p-2 font-medium">
                        {project.title}
                      </th>
                      <td className="p-2">
                        {
                          preview.tracks.find(
                            track => track.id === project.trackId
                          )?.name
                        }
                      </td>
                      <td className="p-2">{preview.judgesPerProject}</td>
                      <td className="p-2">
                        {project.assigned}
                        {project.assigned < preview.judgesPerProject && (
                          <span className="ml-2 font-semibold">
                            Needs judges
                          </span>
                        )}
                      </td>
                      <td className="p-2">{project.completed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </ManagementSection>
      )}
    </div>
  );
}
