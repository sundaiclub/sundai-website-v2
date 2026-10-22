'use client';

import { useEffect, useState } from 'react';
import {
  ManagementAlert,
  ManagementSection,
  useManagementClasses,
} from '../../../../components/ManagementSurface';
import {
  parseEventLocationConfig,
  type EventLocationConfig,
} from '@/lib/eventLocations';

export default function EventLocationsPanel({ eventId }: { eventId: string }) {
  const classes = useManagementClasses();
  const [config, setConfig] = useState<EventLocationConfig>({ locations: [] });
  const [name, setName] = useState('');
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    let current = true;
    setState('loading');
    fetch(`/api/events/${eventId}/locations`)
      .then(async response => {
        if (!response.ok) throw new Error('Unable to load locations.');
        return response.json();
      })
      .then(payload => {
        if (!current) return;
        setConfig(
          parseEventLocationConfig(payload.config) ?? { locations: [] }
        );
        setName('');
        setDirty(false);
        setNotice('');
        setState('ready');
      })
      .catch(() => {
        if (current) setState('error');
      });
    return () => {
      current = false;
    };
  }, [eventId]);

  function withNewLocation() {
    const next = name.trim()
      ? {
          locations: [
            ...config.locations,
            { id: crypto.randomUUID(), name: name.trim() },
          ],
        }
      : config;
    return parseEventLocationConfig(next)!;
  }

  function addLocation() {
    if (!name.trim()) return;
    try {
      setConfig(withNewLocation());
      setName('');
      setDirty(true);
      setNotice('');
    } catch (error) {
      setNotice((error as Error).message);
    }
  }

  async function save() {
    setNotice('');
    try {
      const next = withNewLocation();
      setConfig(next);
      setDirty(true);
      setName('');
      setSaving(true);
      const response = await fetch(`/api/events/${eventId}/locations`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(next),
      });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload.error ?? 'Unable to save locations.');
      setConfig(parseEventLocationConfig(payload.config)!);
      setDirty(false);
      setNotice('Event locations saved.');
    } catch (error) {
      setNotice((error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <ManagementSection
      title="Message locations"
      description="Add the location names you want to use for event messages, including locations that are full."
    >
      {state === 'loading' && <p role="status">Loading locations…</p>}
      {state === 'error' && (
        <ManagementAlert tone="danger">
          Unable to load event locations. Reload the page to try again.
        </ManagementAlert>
      )}
      {state === 'ready' && (
        <fieldset disabled={saving} className="min-w-0 grid gap-4">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end">
            <label className="grid min-w-0 flex-1 gap-2">
              <span className="text-sm font-semibold">Location name</span>
              <input
                className={`${classes.input} w-full min-w-0`}
                value={name}
                maxLength={200}
                placeholder="Enter a location name"
                onChange={event => {
                  setName(event.target.value);
                  setNotice('');
                }}
                onKeyDown={event => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    addLocation();
                  }
                }}
              />
            </label>
            <button
              type="button"
              className={classes.secondaryButton}
              disabled={!name.trim()}
              onClick={addLocation}
            >
              Add location
            </button>
          </div>
          <p className={`text-sm ${classes.mutedText}`}>
            For messages, names match saved location answers. Use the same
            location name that attendees entered.
          </p>
          {config.locations.length > 0 && (
            <ul className="grid min-w-0 gap-2">
              {config.locations.map(location => (
                <li
                  key={location.id}
                  className={`${classes.subtlePanel} flex min-w-0 items-center justify-between gap-3 p-3`}
                >
                  <span className="min-w-0 break-words">{location.name}</span>
                  <button
                    type="button"
                    className={`${classes.ghostButton} shrink-0`}
                    aria-label={`Remove location ${location.name}`}
                    onClick={() => {
                      setConfig(current => ({
                        locations: current.locations.filter(
                          item => item.id !== location.id
                        ),
                      }));
                      setDirty(true);
                      setNotice('');
                    }}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className={`${classes.primaryButton} w-fit`}
              onClick={save}
            >
              {saving ? 'Saving…' : 'Save locations'}
            </button>
            {(dirty || name.trim()) && (
              <span className={`text-sm ${classes.mutedText}`}>
                You have unsaved location changes.
              </span>
            )}
          </div>
          {notice && <p role="status">{notice}</p>}
        </fieldset>
      )}
    </ManagementSection>
  );
}
