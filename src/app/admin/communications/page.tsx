'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { AdminCommunicationListItem } from '@/types/admin-communications';
import type { MessagingHealth } from '@/types/delivery-stats';
import MessagingHealthPanel from './MessagingHealthPanel';
import AdminAuthGate from '../AdminAuthGate';
import CommunicationGroupCard from '../../components/CommunicationGroupCard';
import {
  ManagementAlert,
  ManagementBackButton,
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
            <div>
              {payload?.items.map(item => (
                <Link
                  key={item.id}
                  href={`/admin/communications/${item.id}`}
                  className="block py-2 transition hover:opacity-80"
                >
                  <CommunicationGroupCard
                    communications={item.communications}
                    meta={
                      <>
                        <span className="font-semibold">
                          {item.chapter.name}
                        </span>{' '}
                        · {item.event.title}
                        <br />
                        Sent by {item.sender?.name ?? 'an organizer'} on{' '}
                        {new Date(item.sentAt).toLocaleString()}
                      </>
                    }
                    title={item.subject ?? item.excerpt}
                  />
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
