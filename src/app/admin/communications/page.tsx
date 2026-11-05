'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { AdminCommunicationListItem } from '@/types/admin-communications';
import type { MessagingHealth } from '@/types/delivery-stats';
import MessagingHealthPanel from './MessagingHealthPanel';
import AdminAuthGate from '../AdminAuthGate';
import DeliveryStatsSummary from '../../components/DeliveryStatsSummary';
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
  health: MessagingHealth;
};

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
            description="Review sent organizer communications from all chapters. Email and SMS versions of one message appear together with their delivery and click results."
          />
          {error && <ManagementAlert tone="danger">{error}</ManagementAlert>}
          {payload?.health && (
            <div className="mb-5">
              <MessagingHealthPanel health={payload.health} />
            </div>
          )}
          <ManagementSection>
            <div className={`divide-y ${classes.divider}`}>
              {payload?.items.map(item => (
                <Link
                  key={item.id}
                  href={`/admin/communications/${item.id}`}
                  className="grid gap-4 py-4 transition hover:opacity-75 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,2fr)]"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      {item.communications.map(communication => (
                        <ManagementBadge key={communication.id}>
                          {communication.channel}
                        </ManagementBadge>
                      ))}
                      <span className="font-semibold">
                        {item.subject ?? item.excerpt}
                      </span>
                    </div>
                    <div className={`mt-1 text-sm ${classes.mutedText}`}>
                      {item.chapter.name} · {item.event.title}
                    </div>
                    <div className={`mt-1 text-sm ${classes.mutedText}`}>
                      {new Date(item.sentAt).toLocaleString()} ·{' '}
                      {item.sender?.name ?? 'Unknown sender'}
                    </div>
                  </div>
                  <div className="space-y-3">
                    {item.communications.map(communication => (
                      <div key={communication.id}>
                        {item.communications.length > 1 && (
                          <div className="mb-1 text-xs font-bold uppercase tracking-wide">
                            {communication.channel === 'EMAIL'
                              ? 'Email'
                              : 'SMS'}
                          </div>
                        )}
                        <DeliveryStatsSummary
                          channel={communication.channel}
                          stats={communication.stats}
                        />
                      </div>
                    ))}
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
