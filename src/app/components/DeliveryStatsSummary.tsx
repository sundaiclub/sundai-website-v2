'use client';

import type { DeliveryStats } from '@/types/delivery-stats';
import { ManagementBadge, useManagementClasses } from './ManagementSurface';

export const percent = (value: number, total: number) =>
  total === 0 ? '0%' : `${Math.round((value / total) * 1000) / 10}%`;

// Recipients whose message did not fail and was handed to the provider.
const reached = (stats: DeliveryStats) =>
  stats.total - stats.failed - stats.pending;

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail?: string;
}) {
  const classes = useManagementClasses();
  return (
    <div>
      <div className="text-lg font-bold">{value}</div>
      <div className={`text-xs ${classes.mutedText}`}>
        {label}
        {detail ? ` · ${detail}` : ''}
      </div>
    </div>
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
  const awaiting = stats.accepted + stats.pending;
  const contentLinks = stats.links.filter(link => link.kind === 'CONTENT');
  const preferenceLinks = stats.links.filter(
    link => link.kind === 'PREFERENCES'
  );
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Metric label="Recipients" value={stats.total} />
        <Metric
          label="Delivered"
          value={percent(stats.delivered, stats.total)}
          detail={String(stats.delivered)}
        />
        <Metric
          label="Failed"
          value={percent(stats.failed, stats.total)}
          detail={String(stats.failed)}
        />
        <Metric
          label="Clicked a link"
          value={percent(stats.clicked, reached(stats))}
          detail={String(stats.clicked)}
        />
        {stats.hasEventLinks && (
          <Metric
            label="RSVP after click"
            value={percent(stats.rsvps, stats.clicked)}
            detail={`${stats.rsvps} people`}
          />
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {awaiting > 0 && (
          <ManagementBadge>
            {awaiting} awaiting {isEmail ? 'delivery' : 'carrier'} confirmation
          </ManagementBadge>
        )}
        {(stats.unsubscribed > 0 || stats.preferenceClicks > 0) && (
          <ManagementBadge tone="warning">
            {stats.unsubscribed} one-click unsubscribes ·{' '}
            {stats.preferenceClicks} opened preferences
          </ManagementBadge>
        )}
        {stats.complained > 0 && (
          <ManagementBadge tone="danger">
            {stats.complained} marked as spam (email turned off)
          </ManagementBadge>
        )}
        {stats.botClicks > 0 && (
          <ManagementBadge>
            {stats.botClicks} bot or scanner clicks excluded
          </ManagementBadge>
        )}
      </div>
      {detailed && (
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <h4 className="text-sm font-bold">Why messages failed</h4>
            {stats.failureReasons.length === 0 ? (
              <p className={`mt-1 text-sm ${classes.mutedText}`}>
                No failures.
              </p>
            ) : (
              <ul className={`mt-2 divide-y text-sm ${classes.divider}`}>
                {stats.failureReasons.map(reason => (
                  <li className="py-2" key={reason.code ?? 'unknown'}>
                    <div className="flex justify-between gap-3">
                      <span className="font-semibold">
                        {reason.label}
                        {reason.code && reason.code !== reason.label && (
                          <span
                            className={`ml-1 text-xs font-normal ${classes.mutedText}`}
                          >
                            ({reason.code})
                          </span>
                        )}
                      </span>
                      <span className="shrink-0 font-semibold">
                        {reason.count} · {percent(reason.count, stats.total)}
                      </span>
                    </div>
                    {reason.hint && (
                      <p className={`mt-1 text-xs ${classes.mutedText}`}>
                        {reason.hint}
                      </p>
                    )}
                    {reason.example && (
                      <p
                        className={`mt-1 break-words font-mono text-xs ${classes.mutedText}`}
                      >
                        {reason.example}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <h4 className="text-sm font-bold">Link clicks</h4>
            {stats.links.length === 0 ? (
              <p className={`mt-1 text-sm ${classes.mutedText}`}>
                No tracked links.
              </p>
            ) : (
              <ul className={`mt-2 divide-y text-sm ${classes.divider}`}>
                {[...contentLinks, ...preferenceLinks].map(link => (
                  <li className="py-1.5" key={link.url}>
                    <div className="flex justify-between gap-3">
                      <span className="min-w-0 truncate" title={link.url}>
                        {link.kind === 'PREFERENCES' && (
                          <span className={`mr-1 ${classes.mutedText}`}>
                            Preferences:
                          </span>
                        )}
                        {link.url.replace(/^https?:\/\/(www\.)?/, '')}
                      </span>
                      <span
                        className="shrink-0 font-semibold"
                        title={`${link.clicks} human clicks, ${link.botClicks} bot clicks`}
                      >
                        {link.uniqueClicks} people ·{' '}
                        {percent(link.uniqueClicks, reached(stats))}
                      </span>
                    </div>
                    {link.rsvps !== null && (
                      <p className={`text-xs ${classes.mutedText}`}>
                        {link.rsvps} registered after clicking
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
