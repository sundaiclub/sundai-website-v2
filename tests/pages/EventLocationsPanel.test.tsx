import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import EventLocationsPanel from '@/app/organizer/events/[eventId]/settings/EventLocationsPanel';

jest.mock('@/app/contexts/ThemeContext', () => ({
  useTheme: () => ({ isDarkMode: false }),
}));
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
        : { config: null }
    )
  ) as jest.Mock;
});

it('adds and removes arbitrary names without a question selector or answer mapping', async () => {
  render(<EventLocationsPanel eventId="event-1" />);
  const input = await screen.findByLabelText('Location name');
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  fireEvent.change(input, { target: { value: 'Boston University (BU)' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add location' }));
  fireEvent.change(input, { target: { value: 'Northeastern' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add location' }));
  fireEvent.click(
    screen.getByRole('button', {
      name: 'Remove location Boston University (BU)',
    })
  );
  fireEvent.click(screen.getByRole('button', { name: 'Save locations' }));
  expect(await screen.findByText('Event locations saved.')).toBeVisible();
  const [url, init] = (global.fetch as jest.Mock).mock.calls.find(
    ([, init]) => init?.method === 'PATCH'
  );
  expect(url).toBe('/api/events/event-1/locations');
  expect(JSON.parse(init.body)).toEqual({
    locations: [{ id: 'location-2', name: 'Northeastern' }],
  });
});

it('adds on Enter without submitting the event settings form and rejects duplicates', async () => {
  const submit = jest.fn(event => event.preventDefault());
  render(
    <form onSubmit={submit}>
      <EventLocationsPanel eventId="event-1" />
    </form>
  );
  const input = await screen.findByLabelText('Location name');
  fireEvent.change(input, { target: { value: 'Boston' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(screen.getByText('Boston')).toBeVisible();
  expect(submit).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { value: ' boston ' } });
  fireEvent.click(screen.getByRole('button', { name: 'Add location' }));
  expect(screen.getByText(/must be unique/)).toBeVisible();
});

it('saves the typed name even if Add location was not clicked', async () => {
  render(<EventLocationsPanel eventId="event-1" />);
  fireEvent.change(await screen.findByLabelText('Location name'), {
    target: { value: 'Full venue' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save locations' }));
  expect(await screen.findByText('Event locations saved.')).toBeVisible();
  expect(JSON.parse((global.fetch as jest.Mock).mock.calls[1][1].body)).toEqual(
    { locations: [{ id: 'location-1', name: 'Full venue' }] }
  );
});

it('shows a failed save and keeps the entered locations', async () => {
  (global.fetch as jest.Mock).mockImplementation((_url, init) =>
    init?.method === 'PATCH'
      ? response({ error: 'Unable to save locations.' }, false)
      : response({ config: null })
  );
  render(<EventLocationsPanel eventId="event-1" />);
  fireEvent.change(await screen.findByLabelText('Location name'), {
    target: { value: 'Boston University' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save locations' }));
  expect(await screen.findByText('Unable to save locations.')).toBeVisible();
  expect(screen.getByText('Boston University')).toBeVisible();
  expect(screen.getByText('You have unsaved location changes.')).toBeVisible();
});
