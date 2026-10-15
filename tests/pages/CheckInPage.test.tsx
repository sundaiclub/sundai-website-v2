import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import { getEventPermissionContext } from '@/lib/eventManagementAuth';
import { loadRegistrationByCheckInToken } from '@/lib/eventCheckIn';
import CheckInPage from '../../src/app/check-in/[token]/page';

jest.mock('../../src/app/contexts/ThemeContext', () => ({
  useTheme: () => ({ isDarkMode: false }),
}));

jest.mock('next/navigation', () => ({
  notFound: jest.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
  redirect: jest.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  }),
}));

jest.mock('@clerk/nextjs/server', () => ({ auth: jest.fn() }));

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: { hacker: { findUnique: jest.fn() } },
}));

jest.mock('@/lib/eventManagementAuth', () => ({
  ...jest.requireActual('@/lib/eventManagementAuth'),
  getEventPermissionContext: jest.fn(),
}));

jest.mock('@/lib/eventCheckIn', () => ({
  ...jest.requireActual('@/lib/eventCheckIn'),
  loadRegistrationByCheckInToken: jest.fn(),
}));

const token = '7d4f3c2a-1b0e-4a9d-8c7b-6e5f4d3c2b1a';
const mcContext = {
  actor: { id: 'hacker-mc', role: 'HACKER' },
  chapterMembership: null,
  staff: { id: 'staff-mc', role: 'MC' },
};

function buildRegistration(overrides: Record<string, unknown> = {}) {
  const futureStart = new Date(Date.now() + 2 * 60 * 60 * 1000);
  return {
    id: 'registration-1',
    eventId: 'event-1',
    status: 'APPROVED',
    cancelledAt: null,
    answersJson: { why_this_event: 'To build an AI tutor.' },
    templateSnapshotJson: [
      {
        id: 'why_this_event',
        label: 'Why do you want to join this event?',
        type: 'TEXTAREA',
        required: true,
      },
    ],
    submittedAt: new Date('2026-07-01T12:00:00.000Z'),
    checkedInAt: null,
    checkedInBy: null,
    hacker: {
      id: 'hacker-ada',
      name: 'Ada Lovelace',
      username: 'ada',
      email: 'ada@example.com',
      avatar: null,
    },
    event: {
      id: 'event-1',
      title: 'AI Build Night',
      slug: 'ai-build-night',
      timezone: 'America/New_York',
      startTime: futureStart,
      endTime: new Date(futureStart.getTime() + 4 * 60 * 60 * 1000),
      trackAttendance: true,
      chapter: { slug: 'boston', name: 'Sundai Boston' },
    },
    ...overrides,
  };
}

async function renderCheckInPage() {
  render(await CheckInPage({ params: { token } }));
}

beforeEach(() => {
  jest.clearAllMocks();
  (auth as unknown as jest.Mock).mockReturnValue({ userId: 'clerk-mc' });
  (prisma.hacker.findUnique as jest.Mock).mockResolvedValue({
    id: 'hacker-mc',
  });
  (getEventPermissionContext as jest.Mock).mockResolvedValue(mcContext);
  (loadRegistrationByCheckInToken as jest.Mock).mockResolvedValue(
    buildRegistration()
  );
});

describe('/check-in/[token]', () => {
  it('sends non-organizers back to the event page with a notice', async () => {
    (getEventPermissionContext as jest.Mock).mockResolvedValue({
      actor: { id: 'hacker-ada', role: 'HACKER' },
      chapterMembership: null,
      staff: null,
    });

    await expect(renderCheckInPage()).rejects.toThrow(
      'NEXT_REDIRECT /events/boston/ai-build-night?notice=check-in-organizers-only'
    );
    expect(redirect).toHaveBeenCalled();
  });

  it('shows organizers the application and checks the attendee in', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        registrationId: 'registration-1',
        checkedInAt: '2026-07-18T22:42:00.000Z',
        checkedInBy: 'Morgan MC',
      }),
    }) as jest.Mock;

    await renderCheckInPage();

    expect(
      screen.getByRole('heading', { name: 'Ada Lovelace' })
    ).toBeInTheDocument();
    expect(screen.getByText('To build an AI tutor.')).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Check in Ada Lovelace' })
    );

    await waitFor(() =>
      expect(
        screen.getByText(/Ada Lovelace checked in at 6:42/)
      ).toBeInTheDocument()
    );
    expect(global.fetch).toHaveBeenCalledWith(
      '/api/events/event-1/check-ins',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ registrationId: 'registration-1' }),
      })
    );
  });

  it('shows who already checked the attendee in', async () => {
    (loadRegistrationByCheckInToken as jest.Mock).mockResolvedValue(
      buildRegistration({
        checkedInAt: new Date('2026-07-18T22:42:00.000Z'),
        checkedInBy: { name: 'Morgan MC' },
      })
    );

    await renderCheckInPage();

    expect(screen.getByText(/Already checked in at/)).toHaveTextContent(
      'by Morgan MC'
    );
    expect(
      screen.queryByRole('button', { name: /check in/i })
    ).not.toBeInTheDocument();
  });

  it('closes check-in once the event has been over for a day', async () => {
    const registration = buildRegistration();
    (loadRegistrationByCheckInToken as jest.Mock).mockResolvedValue({
      ...registration,
      event: {
        ...registration.event,
        startTime: new Date('2026-01-01T14:00:00.000Z'),
        endTime: new Date('2026-01-01T18:00:00.000Z'),
      },
    });

    await renderCheckInPage();

    expect(screen.getByText(/This event has ended/)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /check in/i })
    ).not.toBeInTheDocument();
  });

  it('refuses attendees who are not approved', async () => {
    (loadRegistrationByCheckInToken as jest.Mock).mockResolvedValue(
      buildRegistration({ status: 'WAITLISTED' })
    );

    await renderCheckInPage();

    expect(
      screen.getByText(/Only approved attendees can be checked in/)
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /check in/i })
    ).not.toBeInTheDocument();
  });

  it('returns not found for unknown codes', async () => {
    (loadRegistrationByCheckInToken as jest.Mock).mockResolvedValue(null);

    await expect(renderCheckInPage()).rejects.toThrow('NEXT_NOT_FOUND');
  });
});
