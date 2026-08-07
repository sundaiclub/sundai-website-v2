'use client';

import { useEffect, useState } from 'react';
import {
  ManagementAlert,
  ManagementBadge,
  ManagementEmptyState,
  ManagementSection,
  useManagementClasses,
} from '../../../../components/ManagementSurface';
import type { EventReportingPreview } from '@/lib/eventReportingPreview';

function readable(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replaceAll('_', ' ')
    .replace(/^./, character => character.toUpperCase());
}

function MetricList({ metrics }: { metrics: Record<string, number> }) {
  const classes = useManagementClasses();

  return (
    <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {Object.entries(metrics).map(([label, value]) => (
        <div className={`${classes.subtlePanel} p-4`} key={label}>
          <dt className={`text-sm ${classes.mutedText}`}>{readable(label)}</dt>
          <dd className="mt-1 text-2xl font-bold">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function OrganizerEventReportingPage({
  params,
}: {
  params: { eventId: string };
}) {
  const classes = useManagementClasses();
  const [preview, setPreview] = useState<EventReportingPreview | null>(null);
  const [state, setState] = useState<
    'loading' | 'ready' | 'permission-lost' | 'unavailable'
  >('loading');

  useEffect(() => {
    let isCurrent = true;
    setState('loading');
    setPreview(null);

    fetch(`/api/events/${params.eventId}/reporting-preview`)
      .then(async response => {
        if (response.status === 401 || response.status === 403) {
          if (isCurrent) setState('permission-lost');
          return null;
        }
        if (!response.ok) {
          if (isCurrent) setState('unavailable');
          return null;
        }
        return response.json() as Promise<EventReportingPreview>;
      })
      .then(payload => {
        if (!isCurrent || !payload) return;
        setPreview(payload);
        setState('ready');
      })
      .catch(() => {
        if (isCurrent) setState('unavailable');
      });

    return () => {
      isCurrent = false;
    };
  }, [params.eventId]);

  if (state === 'loading') {
    return (
      <ManagementAlert>
        <span role="status">Loading reporting preview…</span>
      </ManagementAlert>
    );
  }

  if (state === 'permission-lost') {
    return (
      <ManagementAlert tone="danger">
        <span role="alert">You no longer have access to this event.</span>
      </ManagementAlert>
    );
  }

  if (state === 'unavailable' || !preview) {
    return (
      <ManagementAlert tone="danger">
        <span role="alert">The reporting preview is unavailable.</span>
      </ManagementAlert>
    );
  }

  const registrationTotal = Object.values(preview.registrations).reduce(
    (total, count) => total + count,
    0
  );

  return (
    <div className="space-y-5">
      <ManagementSection
        title="Reporting preview"
        description="Current operational metrics from completed event workflows. Full reports and exports will arrive in a later phase."
      >
        <div className="space-y-6">
          <section aria-labelledby="registration-funnel-heading">
            <h3 className="mb-3 font-bold" id="registration-funnel-heading">
              Registration funnel
            </h3>
            {registrationTotal === 0 ? (
              <ManagementEmptyState>
                No registrations are available to report yet.
              </ManagementEmptyState>
            ) : (
              <MetricList metrics={preview.registrations} />
            )}
          </section>

          <section aria-labelledby="project-reporting-heading">
            <h3 className="mb-3 font-bold" id="project-reporting-heading">
              Projects and pitch
            </h3>
            {preview.projects.total === 0 ? (
              <ManagementEmptyState>
                No projects are linked to this event yet.
              </ManagementEmptyState>
            ) : (
              <div className="space-y-3">
                <MetricList
                  metrics={{
                    total: preview.projects.total,
                    queued: preview.projects.queued,
                    pitched: preview.projects.pitched,
                    highlighted: preview.projects.highlighted,
                  }}
                />
                <div>
                  <h4 className={`mb-2 text-sm font-bold ${classes.mutedText}`}>
                    Project card readiness
                  </h4>
                  <MetricList metrics={preview.projects.cardStatus} />
                </div>
              </div>
            )}
          </section>

          <section aria-labelledby="materials-reporting-heading">
            <h3 className="mb-3 font-bold" id="materials-reporting-heading">
              Materials
            </h3>
            {preview.materials.total === 0 ? (
              <ManagementEmptyState>
                No event materials have been added yet.
              </ManagementEmptyState>
            ) : (
              <MetricList metrics={preview.materials} />
            )}
          </section>

          <section aria-labelledby="communications-reporting-heading">
            <h3
              className="mb-3 font-bold"
              id="communications-reporting-heading"
            >
              Communication delivery
            </h3>
            {preview.communications.completed === 0 ? (
              <ManagementEmptyState>
                No completed communications are available to report yet.
              </ManagementEmptyState>
            ) : (
              <MetricList metrics={preview.communications} />
            )}
          </section>
        </div>
      </ManagementSection>

      <ManagementSection
        title="Future reporting"
        description="These event-native metrics are intentionally unavailable until their workflows are redesigned and delivered."
      >
        <ul className="grid gap-3 md:grid-cols-3" role="list">
          {preview.unavailable.map(item => (
            <li className={`${classes.subtlePanel} p-4`} key={item.metric}>
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-bold">{item.label}</h3>
                <ManagementBadge>Unavailable</ManagementBadge>
              </div>
              <p className={`mt-2 text-sm ${classes.mutedText}`}>
                {item.reason}
              </p>
            </li>
          ))}
        </ul>
      </ManagementSection>
    </div>
  );
}
