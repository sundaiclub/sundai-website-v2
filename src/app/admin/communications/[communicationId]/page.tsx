'use client';

import { useParams } from 'next/navigation';

import { useEffect, useState } from 'react';
import type { AdminCommunicationDetail } from '@/types/admin-communications';
import AdminAuthGate from '../../AdminAuthGate';
import DeliveryStatsSummary from '../../../components/DeliveryStatsSummary';
import {
  ManagementAlert,
  ManagementBackButton,
  ManagementHeader,
  ManagementPage,
  ManagementSection,
  useManagementClasses,
} from '../../../components/ManagementSurface';
import { useUserContext } from '../../../contexts/UserContext';

export default function AdminCommunicationDetailPage() {
  const params = useParams<{ communicationId: string }>();
  const classes = useManagementClasses();
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
              <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
                <div className="space-y-5">
                  {item.communications.map(communication => (
                    <ManagementSection
                      key={communication.id}
                      title={
                        communication.channel === 'EMAIL'
                          ? 'Email results'
                          : 'SMS results'
                      }
                    >
                      <DeliveryStatsSummary
                        channel={communication.channel}
                        detailed
                        stats={communication.stats}
                      />
                    </ManagementSection>
                  ))}
                </div>
                <ManagementSection title="Sending information">
                  <dl className="grid gap-3 text-sm">
                    <div>
                      <dt className={classes.mutedText}>Sender</dt>
                      <dd>{item.sender?.name ?? 'Unknown sender'}</dd>
                    </div>
                    <div>
                      <dt className={classes.mutedText}>Audience</dt>
                      <dd>{item.audienceType.replaceAll('_', ' ')}</dd>
                    </div>
                    <div>
                      <dt className={classes.mutedText}>Locations</dt>
                      <dd>
                        {Array.isArray(item.audienceDefinition?.locationNames)
                          ? item.audienceDefinition.locationNames.join(', ')
                          : 'All locations'}
                      </dd>
                    </div>
                  </dl>
                </ManagementSection>
              </div>
              <div className="mt-5 space-y-5">
                {item.communications.map(communication => (
                  <ManagementSection
                    key={communication.id}
                    title={
                      communication.channel === 'EMAIL'
                        ? 'Email message'
                        : 'SMS message'
                    }
                    size="large"
                  >
                    <div className="whitespace-pre-wrap break-words leading-7">
                      {communication.body}
                    </div>
                  </ManagementSection>
                ))}
              </div>
            </>
          )}
        </>
      </AdminAuthGate>
    </ManagementPage>
  );
}
