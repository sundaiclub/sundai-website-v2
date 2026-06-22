'use client';

import { useEffect, useState } from 'react';
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
import {
  HackerSearchSelect,
  type HackerSearchOption,
} from '../../components/HackerSearchSelect';
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
  const { isAdmin, loading, userInfo } = useUserContext();
  const [bans, setBans] = useState<AdminBanListItem[]>([]);
  const [flags, setFlags] = useState<AdminBanFlagListItem[]>([]);
  const [hackers, setHackers] = useState<HackerSearchOption[]>([]);
  const [loadError, setLoadError] = useState('');
  const [createError, setCreateError] = useState('');
  const [hackerQuery, setHackerQuery] = useState('');
  const [selectedHacker, setSelectedHacker] =
    useState<HackerSearchOption | null>(null);

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
      fetch('/api/hackers').then(response => {
        if (!response.ok) {
          throw new Error(`Request failed with status ${response.status}`);
        }
        return response.json() as Promise<HackerSearchOption[]>;
      }),
    ])
      .then(([bansPayload, flagsPayload, hackersPayload]) => {
        setBans(banList(bansPayload));
        setFlags(flagList(flagsPayload));
        setHackers(Array.isArray(hackersPayload) ? hackersPayload : []);
      })
      .catch(() => setLoadError('Unable to load moderation data.'));
  }, [isAdmin]);

  async function createBan(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedHacker) {
      setCreateError('Choose a hacker from the list.');
      return;
    }

    setCreateError('');
    const response = await fetch('/api/admin/bans', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ hackerId: selectedHacker.id }),
    });
    if (response.ok) {
      const created = await response.json();
      setBans(current => [created, ...current]);
      setHackerQuery('');
      setSelectedHacker(null);
      return;
    }

    const body = await response.json().catch(() => null);
    setCreateError(body?.message ?? 'Unable to create ban.');
  }

  function handleSelectedHackerChange(hacker: HackerSearchOption | null) {
    setSelectedHacker(hacker);
    setCreateError('');
  }

  return (
    <ManagementPage>
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
            title="Global moderation"
            description="Review global bans and chapter moderation flags."
          />
          {loadError && (
            <div className="mb-5">
              <ManagementAlert tone="danger">{loadError}</ManagementAlert>
            </div>
          )}
          <ManagementSection title="Create ban">
            <div className="mb-8">
              <form onSubmit={createBan} className="flex gap-3">
                <div className="min-w-0 flex-1">
                  <HackerSearchSelect
                    ariaLabel="Search hacker by name"
                    hackers={hackers}
                    query={hackerQuery}
                    selectedHacker={selectedHacker}
                    onQueryChange={setHackerQuery}
                    onSelectedHackerChange={handleSelectedHackerChange}
                    placeholder="Hacker name"
                  />
                </div>
                <button className={classes.primaryButton} type="submit">
                  Create ban
                </button>
              </form>
              {createError && (
                <div className="mt-3">
                  <ManagementAlert tone="danger">{createError}</ManagementAlert>
                </div>
              )}
            </div>
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
