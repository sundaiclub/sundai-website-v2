'use client';

import { useParams } from 'next/navigation';

import { useEffect, useState } from 'react';
import type { AdminCommunicationDetail } from '@/types/admin-communications';
import AdminAuthGate from '../../AdminAuthGate';
import CommunicationGroupCard, {
  locationNames,
} from '../../../components/CommunicationGroupCard';
import {
  ManagementAlert,
  ManagementBackButton,
  ManagementHeader,
  ManagementPage,
} from '../../../components/ManagementSurface';
import { useUserContext } from '../../../contexts/UserContext';

export default function AdminCommunicationDetailPage() {
  const params = useParams<{ communicationId: string }>();
  const { isAdmin, loading, userInfo } = useUserContext();
  const [item, setItem] = useState<AdminCommunicationDetail | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAdmin) return;
    fetch(`/api/admin/communications/${params.communicationId}`)
      .then(response => {
        if (!response.ok) throw new Error(String(response.status));
        return response.json() as Promise<AdminCommunicationDetail>;
      })
      .then(setItem)
      .catch(() => setError('Unable to load this communication.'));
  }, [isAdmin, params.communicationId]);

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
          {error && <ManagementAlert tone="danger">{error}</ManagementAlert>}
          {item && (
            <>
              <ManagementHeader
                eyebrow={`${item.chapter.name} · ${item.communications
                  .map(communication => communication.channel)
                  .join(' + ')}`}
                title={item.subject ?? 'SMS communication'}
                description={`${item.event.title} · Sent ${new Date(item.sentAt).toLocaleString()}`}
              />
              <CommunicationGroupCard
                communications={item.communications}
                detailed
                locations={locationNames(item.audienceDefinition)}
                meta={
                  <>
                    Sent by {item.sender?.name ?? 'an organizer'} to{' '}
                    {item.audienceType.replaceAll('_', ' ').toLowerCase()}{' '}
                    members
                  </>
                }
                title="Delivery results"
              />
            </>
          )}
        </>
      </AdminAuthGate>
    </ManagementPage>
  );
}
