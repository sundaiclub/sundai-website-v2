import React from 'react';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import EventLocationsPanel from '@/app/organizer/events/[eventId]/settings/EventLocationsPanel';

jest.mock('@/app/contexts/ThemeContext', () => ({
  useTheme: () => ({ isDarkMode: false }),
}));
const question = {
  id: 'venue',
  label: 'Pick your location',
  options: [
    { value: 'BU', label: 'Boston University' },
    { value: 'Lowell', label: 'Lowell' },
  ],
};
const response = (payload: unknown, ok = true) =>
  Promise.resolve({ ok, json: async () => payload });

beforeEach(() => {
  let id = 0;
  Object.defineProperty(global.crypto, 'randomUUID', {
    configurable: true,
    value: () => `location-${++id}`,
  });
  global.fetch = jest.fn((_url, init) =>
    response(
      init?.method === 'PATCH'
        ? { config: JSON.parse(String(init.body)) }
        : { config: null, questions: [question] }
    )
  ) as jest.Mock;
});

it('imports old and current answers, permits location names, and saves separate message settings', async () => {
  render(<EventLocationsPanel eventId="event-1" />);
  fireEvent.change(
    await screen.findByLabelText('Location application question'),
    { target: { value: 'venue' } }
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Add locations from answers' })
  );
  fireEvent.change(screen.getByLabelText('Location 1 name'), {
    target: { value: 'BU campus' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save locations' }));
  expect(await screen.findByText('Event locations saved.')).toBeVisible();
  const [url, init] = (global.fetch as jest.Mock).mock.calls.find(
    ([, init]) => init?.method === 'PATCH'
  );
  expect(url).toBe('/api/events/event-1/locations');
  expect(JSON.parse(init.body)).toEqual({
    questionId: 'venue',
    locations: [
      { id: 'location-1', name: 'BU campus', answerValues: ['BU'] },
      { id: 'location-2', name: 'Lowell', answerValues: ['Lowell'] },
    ],
  });
});

it('requires an answer mapping before it saves a new location', async () => {
  render(<EventLocationsPanel eventId="event-1" />);
  fireEvent.change(
    await screen.findByLabelText('Location application question'),
    { target: { value: 'venue' } }
  );
  fireEvent.click(screen.getByRole('button', { name: 'Add location' }));
  fireEvent.change(screen.getByLabelText('Location 1 name'), {
    target: { value: 'Boston' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save locations' }));
  expect(await screen.findByText(/Each location needs/)).toBeVisible();
  expect((global.fetch as jest.Mock).mock.calls).toHaveLength(1);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Boston University' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save locations' }));
  expect(await screen.findByText('Event locations saved.')).toBeVisible();
});

it('shows a failed save and keeps the entered locations', async () => {
  (global.fetch as jest.Mock).mockImplementation((_url, init) =>
    init?.method === 'PATCH'
      ? response({ error: 'Unable to save locations.' }, false)
      : response({ config: null, questions: [question] })
  );
  render(<EventLocationsPanel eventId="event-1" />);
  fireEvent.change(
    await screen.findByLabelText('Location application question'),
    { target: { value: 'venue' } }
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Add locations from answers' })
  );
  fireEvent.click(screen.getByRole('button', { name: 'Save locations' }));
  expect(await screen.findByText('Unable to save locations.')).toBeVisible();
  expect(screen.getByLabelText('Location 1 name')).toHaveValue(
    'Boston University'
  );
});
