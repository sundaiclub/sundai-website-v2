'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { AdminCommunicationListItem } from '@/types/admin-communications';
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

type ListPayload = {
  items: AdminCommunicationListItem[];
  page: number;
  pageSize: number;
  total: number;
};

function percentage(value: number, total: number) {
  return total === 0 ? '0%' : `${Math.round((value / total) * 100)}%`;
}

export default function AdminCommunicationsPage() {
  const classes = useManagementClasses();
  const { isAdmin, loading, userInfo } = useUserContext();
  const [page, setPage] = useState(1);
  const [payload, setPayload] = useState<ListPayload | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAdmin) return;
    setError('');
    fetch(`/api/admin/communications?page=${page}`)
      .then(response => {
        if (!response.ok) throw new Error(String(response.status));
        return response.json() as Promise<ListPayload>;
      })
      .then(setPayload)
      .catch(() => setError('Unable to load communications.'));
  }, [isAdmin, page]);

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
            title="Communications"
            description="Review sent organizer communications from all chapters and their recipient delivery results."
          />
          {error && <ManagementAlert tone="danger">{error}</ManagementAlert>}
          <ManagementSection>
            <div className={`divide-y ${classes.divider}`}>
              {payload?.items.map(item => (
                <Link
                  key={item.id}
                  href={`/admin/communications/${item.id}`}
                  className="grid gap-3 py-4 transition hover:opacity-75 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.2fr)_auto] lg:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <ManagementBadge>{item.channel}</ManagementBadge>
                      <span className="font-semibold">{item.excerpt}</span>
                    </div>
                    <div className={`mt-1 text-sm ${classes.mutedText}`}>
                      {item.chapter.name} · {item.event.title}
                    </div>
                  </div>
                  <div className="text-sm">
                    <div>{new Date(item.sentAt).toLocaleString()}</div>
                    <div className={classes.mutedText}>
                      {item.sentBy?.name ?? 'Unknown sender'}
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div>
                      <div className="font-semibold">
                        {percentage(item.stats.delivered, item.stats.total)}
                      </div>
                      <div className={classes.mutedText}>Delivered</div>
                    </div>
                    <div>
                      <div className="font-semibold">
                        {percentage(item.stats.accepted, item.stats.total)}
                      </div>
                      <div className={classes.mutedText}>Sent</div>
                    </div>
                    <div>
                      <div className="font-semibold">
                        {percentage(item.stats.failed, item.stats.total)}
                      </div>
                      <div className={classes.mutedText}>Failed</div>
                    </div>
                  </div>
                  <div className={`text-sm ${classes.mutedText}`}>
                    {item.stats.total} recipients
                  </div>
                </Link>
              ))}
              {payload && payload.items.length === 0 && (
                <ManagementEmptyState>
                  No sent communications are available.
                </ManagementEmptyState>
              )}
            </div>
            {payload && payload.total > payload.pageSize && (
              <div className="mt-5 flex items-center justify-between">
                <button
                  type="button"
                  className={classes.secondaryButton}
                  disabled={page === 1}
                  onClick={() => setPage(current => current - 1)}
                >
                  Previous
                </button>
                <span className={`text-sm ${classes.mutedText}`}>
                  Page {page} of {Math.ceil(payload.total / payload.pageSize)}
                </span>
                <button
                  type="button"
                  className={classes.secondaryButton}
                  disabled={page * payload.pageSize >= payload.total}
                  onClick={() => setPage(current => current + 1)}
                >
                  Next
                </button>
              </div>
            )}
          </ManagementSection>
        </>
      </AdminAuthGate>
    </ManagementPage>
  );
}
