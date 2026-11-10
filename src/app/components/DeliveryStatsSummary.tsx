'use client';

import type { ReactNode } from 'react';
import type { DeliveryStats } from '@/types/delivery-stats';
import { useManagementClasses } from './ManagementSurface';

export const percent = (value: number, total: number) =>
  total === 0 ? '0%' : `${Math.round((value / total) * 1000) / 10}%`;

// Recipients whose message did not fail and was handed to the provider.
const reached = (stats: DeliveryStats) =>
  stats.total - stats.failed - stats.pending;

const SEGMENTS = {
  delivered: { label: 'Delivered', bar: 'bg-emerald-500' },
  waiting: { label: 'Waiting for confirmation', bar: 'bg-sky-400' },
  failed: { label: 'Failed', bar: 'bg-red-500' },
} as const;

function ChannelIcon({ channel }: { channel: 'EMAIL' | 'SMS' }) {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
    >
      {channel === 'EMAIL' ? (
        <>
          <rect height="16" rx="2" width="20" x="2" y="4" />
          <path d="m22 7-10 6L2 7" />
        </>
      ) : (
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      )}
    </svg>
  );
}

// The share of recipients in each delivery state, as one bar with a legend.
function DeliveryBar({ stats }: { stats: DeliveryStats }) {
  const classes = useManagementClasses();
  const counts = {
    delivered: stats.delivered,
    waiting: stats.accepted + stats.pending,
    failed: stats.failed,
  };
  const keys = Object.keys(SEGMENTS) as Array<keyof typeof SEGMENTS>;
  return (
    <div>
      <div
        aria-hidden="true"
        className={`flex h-2.5 overflow-hidden rounded-full ${
          classes.isDarkMode ? 'bg-gray-800' : 'bg-gray-200'
        }`}
      >
        {keys.map(key =>
          counts[key] > 0 ? (
            <div
              className={SEGMENTS[key].bar}
              key={key}
              style={{ width: `${(counts[key] / stats.total) * 100}%` }}
            />
          ) : null
        )}
      </div>
      <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
        {keys.map(key => (
          <div className="flex items-center gap-1.5" key={key}>
            <span
              aria-hidden="true"
              className={`h-2.5 w-2.5 rounded-full ${SEGMENTS[key].bar}`}
            />
            <dt className={classes.mutedText}>{SEGMENTS[key].label}</dt>
            <dd className="font-bold">
              {percent(counts[key], stats.total)}
              <span className={`ml-1 font-normal ${classes.mutedText}`}>
                ({counts[key]})
              </span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Tile({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  const classes = useManagementClasses();
  return (
    <div
      className={`rounded-md border px-3 py-2 ${
        classes.isDarkMode
          ? 'border-gray-800 bg-gray-900'
          : 'border-gray-200 bg-white'
      }`}
    >
      <div
        className={`text-[11px] font-bold uppercase tracking-wide ${classes.mutedText}`}
      >
        {label}
      </div>
      <div className="text-xl font-bold leading-tight">{value}</div>
      <div className={`text-xs ${classes.mutedText}`}>{detail}</div>
    </div>
  );
}

function Callout({
  tone,
  children,
}: {
  tone: 'danger' | 'warning' | 'neutral';
  children: ReactNode;
}) {
  const { isDarkMode } = useManagementClasses();
  const colors = {
    danger: isDarkMode
      ? 'border-red-900/70 bg-red-950/40 text-red-100'
      : 'border-red-200 bg-red-50 text-red-900',
    warning: isDarkMode
      ? 'border-amber-900/70 bg-amber-950/40 text-amber-100'
      : 'border-amber-200 bg-amber-50 text-amber-900',
    neutral: isDarkMode
      ? 'border-gray-800 bg-gray-900 text-gray-300'
      : 'border-gray-200 bg-white text-gray-700',
  };
  return (
    <p className={`rounded-md border px-3 py-1.5 text-xs ${colors[tone]}`}>
      {children}
    </p>
  );
}

function SectionHeading({ children }: { children: ReactNode }) {
  const classes = useManagementClasses();
  return (
    <h5
      className={`mb-2 text-[11px] font-bold uppercase tracking-wide ${classes.mutedText}`}
    >
      {children}
    </h5>
  );
}

export default function DeliveryStatsSummary({
  channel,
  stats,
  detailed = false,
}: {
  channel: 'EMAIL' | 'SMS';
  stats: DeliveryStats;
  detailed?: boolean;
}) {
  const classes = useManagementClasses();
  const isEmail = channel === 'EMAIL';
  const contentLinks = stats.links.filter(link => link.kind === 'CONTENT');
  const preferenceLinks = stats.links.filter(
    link => link.kind === 'PREFERENCES'
  );
  const hasLinks = stats.links.length > 0;
  const unsubscribes = stats.unsubscribed + stats.preferenceClicks;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h4 className="flex items-center gap-2 font-bold">
          <ChannelIcon channel={channel} />
          {isEmail ? 'Email' : 'SMS'}
        </h4>
        <span className={`text-sm ${classes.mutedText}`}>
          {stats.total} recipient{stats.total === 1 ? '' : 's'}
        </span>
      </div>

      {stats.total === 0 ? (
        <p className={`text-sm ${classes.mutedText}`}>
          No one was eligible for this message.
        </p>
      ) : (
        <DeliveryBar stats={stats} />
      )}

      {hasLinks && (
        <div>
          <SectionHeading>Engagement</SectionHeading>
          <div className="grid grid-cols-2 gap-2">
            <Tile
              label="Clicked a link"
              value={percent(stats.clicked, reached(stats))}
              detail={`${stats.clicked} people`}
            />
            {stats.hasEventLinks && (
              <Tile
                label="RSVP'd after clicking"
                value={percent(stats.rsvps, stats.clicked)}
                detail={`${stats.rsvps} of ${stats.clicked} who clicked`}
              />
            )}
          </div>
        </div>
      )}

      {(stats.complained > 0 || unsubscribes > 0 || stats.botClicks > 0) && (
        <div className="space-y-1.5">
          {stats.complained > 0 && (
            <Callout tone="danger">
              <strong>{stats.complained} marked this as spam.</strong> Their
              chapter email is turned off.
            </Callout>
          )}
          {unsubscribes > 0 && (
            <Callout tone="warning">
              <strong>{stats.unsubscribed} unsubscribed</strong> with one click
              · {stats.preferenceClicks} opened their preferences
            </Callout>
          )}
          {stats.botClicks > 0 && (
            <Callout tone="neutral">
              {stats.botClicks} automated clicks from link scanners are not
              counted.
            </Callout>
          )}
        </div>
      )}

      {detailed && (
        <div className="space-y-4">
          <div>
            <SectionHeading>Why messages failed</SectionHeading>
            {stats.failureReasons.length === 0 ? (
              <p className={`text-sm ${classes.mutedText}`}>No failures.</p>
            ) : (
              <ul className="space-y-2">
                {stats.failureReasons.map(reason => (
                  <li
                    className={`rounded-md border p-3 text-sm ${
                      classes.isDarkMode
                        ? 'border-gray-800 bg-gray-900'
                        : 'border-gray-200 bg-white'
                    }`}
                    key={reason.code ?? 'unknown'}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <span className="font-semibold">{reason.label}</span>
                        {reason.code && reason.code !== reason.label && (
                          <code
                            className={`ml-2 rounded px-1 text-xs ${
                              classes.isDarkMode
                                ? 'bg-gray-800 text-gray-300'
                                : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {reason.code}
                          </code>
                        )}
                      </div>
                      <span className="shrink-0 font-bold text-red-600">
                        {reason.count}
                      </span>
                    </div>
                    {reason.hint && (
                      <p className={`mt-1 text-xs ${classes.mutedText}`}>
                        What to do: {reason.hint}
                      </p>
                    )}
                    {reason.example && (
                      <p
                        className={`mt-2 break-words rounded px-2 py-1 font-mono text-xs ${
                          classes.isDarkMode
                            ? 'bg-gray-950 text-gray-400'
                            : 'bg-gray-50 text-gray-600'
                        }`}
                      >
                        {reason.example}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
          {hasLinks && (
            <div>
              <SectionHeading>Links</SectionHeading>
              <ul
                className={`divide-y rounded-md border text-sm ${classes.divider} ${
                  classes.isDarkMode ? 'border-gray-800' : 'border-gray-200'
                }`}
              >
                {[...contentLinks, ...preferenceLinks].map(link => (
                  <li
                    className="flex items-center justify-between gap-3 px-3 py-2"
                    key={link.url}
                  >
                    <div className="min-w-0">
                      <div className="truncate" title={link.url}>
                        {link.url.replace(/^https?:\/\/(www\.)?/, '')}
                      </div>
                      <div className={`text-xs ${classes.mutedText}`}>
                        {link.kind === 'PREFERENCES'
                          ? 'Unsubscribe or preferences link'
                          : link.rsvps !== null
                            ? `Event page · ${link.rsvps} RSVP'd after clicking`
                            : 'Link'}
                      </div>
                    </div>
                    <div
                      className="shrink-0 text-right"
                      title={`${link.clicks} clicks, ${link.botClicks} automated clicks not counted`}
                    >
                      <div className="font-bold">{link.uniqueClicks}</div>
                      <div className={`text-xs ${classes.mutedText}`}>
                        people
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
