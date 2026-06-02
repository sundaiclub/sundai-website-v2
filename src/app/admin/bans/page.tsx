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
import { useUserContext } from '../../contexts/UserContext';
import type {
  AdminBanFlagListItem,
  AdminBanListItem,
} from '@/types/event-management';

type HackerOption = {
  id: string;
  name: string;
  email?: string | null;
};

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
  const [hackers, setHackers] = useState<HackerOption[]>([]);
  const [loadError, setLoadError] = useState('');
  const [createError, setCreateError] = useState('');
  const [hackerQuery, setHackerQuery] = useState('');
  const [selectedHacker, setSelectedHacker] = useState<HackerOption | null>(
    null
  );
  const [showHackerOptions, setShowHackerOptions] = useState(false);

  const normalizedHackerQuery = hackerQuery.trim().toLowerCase();
  const filteredHackers =
    normalizedHackerQuery.length === 0 || selectedHacker
      ? []
      : hackers
          .filter(hacker => {
            const name = hacker.name.toLowerCase();
            const email = hacker.email?.toLowerCase() ?? '';
            return (
              name.includes(normalizedHackerQuery) ||
              email.includes(normalizedHackerQuery)
            );
          })
          .slice(0, 8);

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
        return response.json() as Promise<HackerOption[]>;
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
      setShowHackerOptions(false);
      return;
    }

    const body = await response.json().catch(() => null);
    setCreateError(body?.message ?? 'Unable to create ban.');
  }

  function updateHackerQuery(value: string) {
    setHackerQuery(value);
    setSelectedHacker(null);
    setShowHackerOptions(true);
    setCreateError('');
  }

  function chooseHacker(hacker: HackerOption) {
    setSelectedHacker(hacker);
    setHackerQuery(hacker.name);
    setShowHackerOptions(false);
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
                <div className="relative min-w-0 flex-1">
                  <input
                    aria-label="Search hacker by name"
                    aria-controls="global-ban-hacker-options"
                    autoComplete="off"
                    className={`${classes.input} w-full`}
                    value={hackerQuery}
                    onChange={event => updateHackerQuery(event.target.value)}
                    onFocus={() => setShowHackerOptions(true)}
                    placeholder="Hacker name"
                  />
                  {showHackerOptions && normalizedHackerQuery && (
                    <div
                      id="global-ban-hacker-options"
                      role="listbox"
                      className={`absolute left-0 right-0 top-full z-20 mt-2 max-h-72 overflow-y-auto rounded-md border shadow-lg ${
                        classes.panel
                      }`}
                    >
                      {filteredHackers.map(hacker => (
                        <button
                          key={hacker.id}
                          role="option"
                          aria-selected={false}
                          type="button"
                          className={`block w-full px-4 py-3 text-left text-sm transition ${
                            classes.isDarkMode
                              ? 'hover:bg-gray-800'
                              : 'hover:bg-gray-100'
                          }`}
                          onClick={() => chooseHacker(hacker)}
                        >
                          <span className="block font-semibold">
                            {hacker.name}
                          </span>
                          {hacker.email && (
                            <span className={`block ${classes.mutedText}`}>
                              {hacker.email}
                            </span>
                          )}
                        </button>
                      ))}
                      {filteredHackers.length === 0 && (
                        <div className={`px-4 py-3 text-sm ${classes.mutedText}`}>
                          No hackers found.
                        </div>
                      )}
                    </div>
                  )}
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
