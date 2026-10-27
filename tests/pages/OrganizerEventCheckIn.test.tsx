jest.mock('next/navigation', () => ({
  ...jest.requireActual('next/navigation'),
  useParams: () => ({ eventId: 'event-1' }),
}));

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import OrganizerEventCheckInPage from '../../src/app/organizer/events/[eventId]/check-in/page';
import type { EventCheckInList } from '@/types/event-workspace';

jest.mock('../../src/app/contexts/ThemeContext', () => ({
  useTheme: () => ({ isDarkMode: false }),
}));

jest.mock('../../src/app/organizer/events/[eventId]/WorkspaceShell', () => ({
  useEventWorkspace: () => ({
    event: { id: 'event-1', timezone: 'America/New_York' },
  }),
}));

const listPayload = (
  overrides: Partial<EventCheckInList> = {}
): EventCheckInList => ({
  trackAttendance: true,
  counts: { approved: 3, checkedIn: 1 },
  hasMore: false,
  rows: [
    {
      registrationId: 'registration-ada',
      hackerId: 'hacker-ada',
      name: 'Ada Lovelace',
      username: 'ada',
      email: 'ada@example.com',
      checkedInAt: null,
      checkedInBy: null,
    },
    {
      registrationId: 'registration-grace',
      hackerId: 'hacker-grace',
      name: 'Grace Hopper',
      username: null,
      email: 'grace@example.com',
      checkedInAt: '2026-07-18T22:05:00.000Z',
      checkedInBy: 'Morgan MC',
    },
  ],
  ...overrides,
});

function jsonResponse(data: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  });
}

function renderPage() {
  return render(<OrganizerEventCheckInPage />);
}

describe('/organizer/events/[eventId]/check-in', () => {
  it('shows how many approved attendees have checked in', async () => {
    global.fetch = jest.fn(() => jsonResponse(listPayload())) as jest.Mock;

    renderPage();

    expect(await screen.findByText('1 / 3')).toBeInTheDocument();
    expect(screen.getByText(/approved attendees · 33%/)).toBeInTheDocument();
    expect(
      screen.getByText('Checked in 6:05 PM by Morgan MC')
    ).toBeInTheDocument();
  });

  it('searches the approved list by name, email, or username', async () => {
    global.fetch = jest.fn(() => jsonResponse(listPayload())) as jest.Mock;
    renderPage();
    await screen.findByText('1 / 3');

    fireEvent.change(screen.getByLabelText('Search approved attendees'), {
      target: { value: 'grace' },
    });

    await waitFor(() =>
      expect(global.fetch).toHaveBeenLastCalledWith(
        '/api/events/event-1/check-ins?search=grace'
      )
    );
  });

  it('checks an attendee in manually and updates the count', async () => {
    global.fetch = jest.fn((url: string, init?: RequestInit) =>
      init?.method === 'POST'
        ? jsonResponse({
            registrationId: 'registration-ada',
            checkedInAt: '2026-07-18T22:30:00.000Z',
            checkedInBy: 'Morgan MC',
          })
        : jsonResponse(listPayload())
    ) as jest.Mock;
    renderPage();
    await screen.findByText('1 / 3');

    fireEvent.click(screen.getByRole('button', { name: 'Check in' }));

    expect(await screen.findByText('2 / 3')).toBeInTheDocument();
    expect(
      screen.getByText('Checked in 6:30 PM by Morgan MC')
    ).toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/events/event-1/check-ins',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ registrationId: 'registration-ada' }),
      })
    );
  });

  it('shows check-in errors from the server', async () => {
    global.fetch = jest.fn((url: string, init?: RequestInit) =>
      init?.method === 'POST'
        ? jsonResponse(
            { reason: 'EVENT_ENDED', message: 'This event has ended.' },
            409
          )
        : jsonResponse(listPayload())
    ) as jest.Mock;
    renderPage();
    await screen.findByText('1 / 3');

    fireEvent.click(screen.getByRole('button', { name: 'Check in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This event has ended.'
    );
    expect(screen.getByText('1 / 3')).toBeInTheDocument();
  });
});
