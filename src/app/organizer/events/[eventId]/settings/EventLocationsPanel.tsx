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
  type EventLocationQuestion,
} from '@/lib/eventLocations';

export default function EventLocationsPanel({ eventId }: { eventId: string }) {
  const classes = useManagementClasses();
  const [questions, setQuestions] = useState<EventLocationQuestion[]>([]);
  const [config, setConfig] = useState<EventLocationConfig>({
    questionId: '',
    locations: [],
  });
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const question = questions.find(item => item.id === config.questionId);

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
        setQuestions(payload.questions);
        setConfig(payload.config ?? { questionId: '', locations: [] });
        setState('ready');
      })
      .catch(() => {
        if (current) setState('error');
      });
    return () => {
      current = false;
    };
  }, [eventId]);

  async function save() {
    setNotice('');
    try {
      parseEventLocationConfig(config);
      setSaving(true);
      const response = await fetch(`/api/events/${eventId}/locations`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(config),
      });
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload.error ?? 'Unable to save locations.');
      setConfig(payload.config);
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
      description="Create locations for event messages. Link each location to existing application answers. This does not change the application."
    >
      {state === 'loading' && <p role="status">Loading locations…</p>}
      {state === 'error' && (
        <ManagementAlert tone="danger">
          Unable to load event locations. Reload the page to try again.
        </ManagementAlert>
      )}
      {state === 'ready' && (
        <fieldset disabled={saving} className="grid gap-4">
          <label className="grid gap-2">
            <span className="text-sm font-semibold">
              Location application question
            </span>
            <select
              className={classes.input}
              value={config.questionId}
              onChange={event => {
                setConfig({ questionId: event.target.value, locations: [] });
                setNotice('');
              }}
            >
              <option value="">Select the location question</option>
              {questions.map(item => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <p className={classes.mutedText}>
            Choices include previous application answers, even if a venue is now
            full. Changing the question clears the location list until you save
            it again.
          </p>
          {question && (
            <>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  className={classes.secondaryButton}
                  onClick={() => {
                    setConfig(current => ({
                      ...current,
                      locations: [
                        ...current.locations,
                        ...question.options
                          .filter(
                            option =>
                              !current.locations.some(location =>
                                location.answerValues.includes(option.value)
                              )
                          )
                          .map(option => ({
                            id: crypto.randomUUID(),
                            name: option.label,
                            answerValues: [option.value],
                          })),
                      ],
                    }));
                    setNotice('');
                  }}
                >
                  Add locations from answers
                </button>
                <button
                  type="button"
                  className={classes.secondaryButton}
                  onClick={() => {
                    setConfig(current => ({
                      ...current,
                      locations: [
                        ...current.locations,
                        { id: crypto.randomUUID(), name: '', answerValues: [] },
                      ],
                    }));
                    setNotice('');
                  }}
                >
                  Add location
                </button>
              </div>
              {config.locations.map((location, index) => (
                <div
                  key={location.id}
                  className={`${classes.subtlePanel} grid gap-3 p-4`}
                >
                  <label className="grid gap-2">
                    <span className="text-sm font-semibold">Location name</span>
                    <input
                      aria-label={`Location ${index + 1} name`}
                      className={classes.input}
                      value={location.name}
                      maxLength={200}
                      onChange={event => {
                        setConfig(current => ({
                          ...current,
                          locations: current.locations.map(item =>
                            item.id === location.id
                              ? { ...item, name: event.target.value }
                              : item
                          ),
                        }));
                        setNotice('');
                      }}
                    />
                  </label>
                  <fieldset>
                    <legend className="mb-2 text-sm font-semibold">
                      Include these application answers
                    </legend>
                    <div className="flex flex-wrap gap-4">
                      {question.options.map(option => (
                        <label
                          key={option.value}
                          className="flex items-center gap-2 text-sm"
                        >
                          <input
                            type="checkbox"
                            className={classes.checkbox}
                            checked={location.answerValues.includes(
                              option.value
                            )}
                            disabled={config.locations.some(
                              item =>
                                item.id !== location.id &&
                                item.answerValues.includes(option.value)
                            )}
                            onChange={event => {
                              const checked = event.target.checked;
                              setConfig(current => ({
                                ...current,
                                locations: current.locations.map(item =>
                                  item.id === location.id
                                    ? {
                                        ...item,
                                        answerValues: checked
                                          ? [...item.answerValues, option.value]
                                          : item.answerValues.filter(
                                              value => value !== option.value
                                            ),
                                      }
                                    : item
                                ),
                              }));
                              setNotice('');
                            }}
                          />
                          {option.label}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <button
                    type="button"
                    className={`${classes.ghostButton} w-fit`}
                    aria-label={`Remove location ${location.name || index + 1}`}
                    onClick={() => {
                      setConfig(current => ({
                        ...current,
                        locations: current.locations.filter(
                          item => item.id !== location.id
                        ),
                      }));
                      setNotice('');
                    }}
                  >
                    Remove location
                  </button>
                </div>
              ))}
              <button
                type="button"
                className={`${classes.primaryButton} w-fit`}
                onClick={save}
              >
                {saving ? 'Saving…' : 'Save locations'}
              </button>
            </>
          )}
          {notice && <p role="status">{notice}</p>}
        </fieldset>
      )}
    </ManagementSection>
  );
}
