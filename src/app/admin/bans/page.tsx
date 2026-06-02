'use client';

import { useEffect, useState } from 'react';
import AdminAuthGate from '../AdminAuthGate';
import {
  ManagementAlert,
  ManagementBadge,
  ManagementEmptyState,
  ManagementHeader,
  ManagementPage,
  ManagementSection,
  useManagementClasses,
} from '../../components/ManagementSurface';
import { useUserContext } from '../../contexts/UserContext';
import type {
  AdminBanFlagListItem,
  AdminBanListItem,
} from '@/types/event-management';

function banList(payload: unknown): AdminBanListItem[] {
  if (Array.isArray(payload)) return payload as AdminBanListItem[];
  if (payload && typeof payload === 'object') {
    const value = payload as {
      bans?: AdminBanListItem[];
      items?: AdminBanListItem[];
    };
    return value.bans ?? value.items ?? [];
  }
  return [];
}

function flagList(payload: unknown): AdminBanFlagListItem[] {
  if (Array.isArray(payload)) return payload as AdminBanFlagListItem[];
  if (payload && typeof payload === 'object') {
    const value = payload as {
      banFlags?: AdminBanFlagListItem[];
      flags?: AdminBanFlagListItem[];
      items?: AdminBanFlagListItem[];
    };
    return value.banFlags ?? value.flags ?? value.items ?? [];
  }
  return [];
}

export default function AdminBansPage() {
  const classes = useManagementClasses();
  const { isAdmin, loading } = useUserContext();
  const [bans, setBans] = useState<AdminBanListItem[]>([]);
  const [flags, setFlags] = useState<AdminBanFlagListItem[]>([]);
  const [loadError, setLoadError] = useState('');
  const [hackerId, setHackerId] = useState('');

  useEffect(() => {
    if (!isAdmin) return;
    setLoadError('');
    Promise.all([
      fetch('/api/admin/bans').then(response => {
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        return response.json() as Promise<unknown>;
      }),
      fetch('/api/admin/ban-flags').then(response => {
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        return response.json() as Promise<unknown>;
      }),
    ])
      .then(([bansPayload, flagsPayload]) => {
        setBans(banList(bansPayload));
        setFlags(flagList(flagsPayload));
      })
      .catch(() => setLoadError('Unable to load moderation data.'));
  }, [isAdmin]);

  async function createBan(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch('/api/admin/bans', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ hackerId }),
    });
    if (response.ok) {
      const created = await response.json();
      setBans(current => [created, ...current]);
      setHackerId('');
    }
  }

  return (
    <ManagementPage>
      <AdminAuthGate isAdmin={isAdmin} loading={loading}>
        <>
          <ManagementHeader
            eyebrow="Site admin"
            title="Global moderation"
            description="Review global bans and chapter moderation flags."
          />
          {loadError && (
            <div className="mb-5">
              <ManagementAlert tone="danger">{loadError}</ManagementAlert>
            </div>
          )}
          <ManagementSection title="Create ban">
            <form onSubmit={createBan} className="flex gap-3 mb-8">
              <input
                aria-label="Search hacker"
                className={`${classes.input} min-w-0 flex-1`}
                value={hackerId}
                onChange={event => setHackerId(event.target.value)}
                placeholder="Hacker ID"
              />
              <button className={classes.primaryButton} type="submit">
                Create ban
              </button>
            </form>
          </ManagementSection>

          <div className="mt-5 grid gap-5">
            <ManagementSection title="Active bans">
              <div className={`divide-y ${classes.divider}`}>
                {bans.map(ban => (
                  <div
                    key={ban.id}
                    className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold">
                        {ban.hacker?.name || ban.hackerName || ban.hackerId}
                      </div>
                      <div className={`mt-1 text-sm ${classes.mutedText}`}>
                        {ban.publicSafeReason || ban.publicReason}
                      </div>
                    </div>
                    <button className={classes.secondaryButton} type="button">
                      Revoke
                    </button>
                  </div>
                ))}
                {bans.length === 0 && (
                  <ManagementEmptyState>
                    No active bans are listed.
                  </ManagementEmptyState>
                )}
              </div>
            </ManagementSection>

            <ManagementSection title="Ban flags">
              <div className={`divide-y ${classes.divider}`}>
                {flags.map(flag => (
                  <div
                    key={flag.id}
                    className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold">
                        {flag.hackerName || flag.id}
                      </div>
                      <div className={`mt-1 text-sm ${classes.mutedText}`}>
                        {flag.reason}
                      </div>
                    </div>
                    <ManagementBadge
                      tone={flag.status === 'OPEN' ? 'warning' : 'default'}
                    >
                      {flag.status}
                    </ManagementBadge>
                    <button className={classes.secondaryButton} type="button">
                      Resolve
                    </button>
                  </div>
                ))}
                {flags.length === 0 && (
                  <ManagementEmptyState>
                    No ban flags need review.
                  </ManagementEmptyState>
                )}
              </div>
            </ManagementSection>
          </div>
        </>
      </AdminAuthGate>
    </ManagementPage>
  );
}
