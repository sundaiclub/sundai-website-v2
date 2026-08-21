'use client';

import { useEffect, useState, use } from 'react';
import type { AdminCommunicationDetail } from '@/types/admin-communications';
import AdminAuthGate from '../../AdminAuthGate';
import {
  ManagementAlert,
  ManagementBackButton,
  ManagementBadge,
  ManagementEmptyState,
  ManagementHeader,
  ManagementPage,
  ManagementSection,
  useManagementClasses,
} from '../../../components/ManagementSurface';
import { useUserContext } from '../../../contexts/UserContext';

export default function AdminCommunicationDetailPage(props: {
  params: Promise<{ communicationId: string }>;
}) {
  const params = use(props.params);
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
                eyebrow={`${item.chapter.name} · ${item.channel}`}
                title={item.subject ?? 'SMS communication'}
                description={`${item.event.title} · Sent ${new Date(item.sentAt).toLocaleString()}`}
              />
              <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
                <ManagementSection title="Full message" size="large">
                  <div className="whitespace-pre-wrap break-words leading-7">
                    {item.body}
                  </div>
                </ManagementSection>
                <ManagementSection title="Sending information">
                  <dl className="grid gap-3 text-sm">
                    <div>
                      <dt className={classes.mutedText}>Sender</dt>
                      <dd>{item.sentBy?.name ?? 'Unknown sender'}</dd>
                    </div>
                    <div>
                      <dt className={classes.mutedText}>Audience</dt>
                      <dd>{item.audienceType.replaceAll('_', ' ')}</dd>
                    </div>
                    <div>
                      <dt className={classes.mutedText}>Recipients</dt>
                      <dd>{item.stats.total}</dd>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <dt className={classes.mutedText}>Delivered</dt>
                        <dd>{item.stats.delivered}</dd>
                      </div>
                      <div>
                        <dt className={classes.mutedText}>Sent</dt>
                        <dd>{item.stats.accepted}</dd>
                      </div>
                      <div>
                        <dt className={classes.mutedText}>Failed</dt>
                        <dd>{item.stats.failed}</dd>
                      </div>
                      <div>
                        <dt className={classes.mutedText}>Pending</dt>
                        <dd>{item.stats.pending}</dd>
                      </div>
                    </div>
                  </dl>
                </ManagementSection>
              </div>
              <div className="mt-5">
                <ManagementSection title="Recipient results">
                  <div className={`divide-y ${classes.divider}`}>
                    {item.recipients.map(recipient => (
                      <div
                        key={recipient.id}
                        className="grid gap-2 py-4 text-sm md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)_auto_minmax(0,1fr)] md:items-center"
                      >
                        <div className="font-semibold">
                          {recipient.displayName}
                        </div>
                        <div className="break-all">
                          {recipient.contactValue}
                        </div>
                        <ManagementBadge
                          tone={
                            ['FAILED', 'UNDELIVERED'].includes(recipient.status)
                              ? 'danger'
                              : recipient.status === 'DELIVERED'
                                ? 'success'
                                : 'default'
                          }
                        >
                          {recipient.status}
                        </ManagementBadge>
                        <div className={`space-y-1 ${classes.mutedText}`}>
                          <div>
                            {recipient.providerMessageId ?? 'No provider ID'}
                          </div>
                          {recipient.errorCode && (
                            <div>
                              Error {recipient.errorCode}
                              {recipient.errorMessage
                                ? `: ${recipient.errorMessage}`
                                : ''}
                            </div>
                          )}
                          {recipient.attemptedAt && (
                            <div>
                              Attempted{' '}
                              {new Date(recipient.attemptedAt).toLocaleString()}
                            </div>
                          )}
                          {recipient.deliveredAt && (
                            <div>
                              Delivered{' '}
                              {new Date(recipient.deliveredAt).toLocaleString()}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    {item.recipients.length === 0 && (
                      <ManagementEmptyState>
                        No recipients were eligible.
                      </ManagementEmptyState>
                    )}
                  </div>
                </ManagementSection>
              </div>
            </>
          )}
        </>
      </AdminAuthGate>
    </ManagementPage>
  );
}
