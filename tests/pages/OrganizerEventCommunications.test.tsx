import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mockUseTheme = jest.fn();

jest.mock('../../src/app/contexts/ThemeContext', () => ({
  useTheme: () => mockUseTheme(),
}));

const eventId = 'event-ai-build-night';

function jsonResponse(data: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(data),
    text: jest.fn().mockResolvedValue(JSON.stringify(data)),
  });
}

function requestUrl(input: RequestInfo | URL) {
  return typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.toString()
      : input.url;
}

const sentCommunication = {
  id: 'blast-sent',
  eventId,
  channel: 'EMAIL',
  status: 'PARTIAL',
  subject: 'Tomorrow’s build night',
  body: 'Doors open at 9:30.',
  audienceType: 'APPROVED',
  creator: { id: 'hacker-mc', name: 'Morgan MC' },
  sender: { id: 'hacker-mc', name: 'Morgan MC' },
  recipientCount: 42,
  sentCount: 40,
  failedCount: 2,
  sentAt: '2026-07-17T14:00:00.000Z',
};

function mockCommunicationFetch({ changedAudience = false } = {}) {
  global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = requestUrl(input);
    if (url === `/api/events/${eventId}/blasts` && !init?.method) {
      return jsonResponse({
        items: [sentCommunication],
        providerAvailability: {
          email: { available: true },
          sms: {
            available: false,
            reason:
              'SMS requires provider configuration and active consent copy.',
          },
        },
      });
    }
    if (url === `/api/events/${eventId}/blasts` && init?.method === 'POST') {
      return jsonResponse(
        {
          id: 'blast-draft',
          status: 'DRAFT',
          ...JSON.parse(String(init.body)),
        },
        201
      );
    }
    if (url.endsWith('/blasts/blast-draft/preview')) {
      return jsonResponse({
        channel: 'EMAIL',
        eligibleCount: changedAudience ? 41 : 42,
        exclusions: {
          cancelled: changedAudience ? 1 : 0,
          missingContact: 1,
          preferenceDisabled: 3,
          ineligible: 0,
        },
        previewFingerprint: changedAudience
          ? 'sha256:changed'
          : 'sha256:original',
      });
    }
    if (url.endsWith('/blasts/blast-draft/send')) {
      if (changedAudience) {
        return jsonResponse(
          {
            error: 'Audience changed',
            preview: {
              channel: 'EMAIL',
              eligibleCount: 41,
              exclusions: {
                cancelled: 1,
                missingContact: 1,
                preferenceDisabled: 3,
                ineligible: 0,
              },
              previewFingerprint: 'sha256:changed',
            },
          },
          409
        );
      }
      return jsonResponse({ ...sentCommunication, id: 'blast-draft' });
    }
    if (url === `/api/events/${eventId}/blasts/${sentCommunication.id}`) {
      return jsonResponse({
        ...sentCommunication,
        audienceDefinition: { statuses: ['APPROVED'] },
        recipients: [
          {
            id: 'recipient-sent',
            displayName: 'Ada Builder',
            contactValue: 'ada@example.com',
            status: 'SENT',
          },
          {
            id: 'recipient-failed',
            displayName: 'Grace Builder',
            contactValue: 'grace@example.com',
            status: 'FAILED',
            errorMessage: 'Provider rejected destination',
          },
        ],
      });
    }
    return jsonResponse({ error: `Unexpected request: ${url}` }, 500);
  }) as jest.Mock;
}

function loadPage(): React.ComponentType<{ params: { eventId: string } }> {
  try {
    return require('../../src/app/organizer/events/[eventId]/communications/page')
      .default;
  } catch (error) {
    throw new Error(
      `Expected organizer communications page for T051: ${String(error)}`
    );
  }
}

function renderPage() {
  const Page = loadPage();
  return render(<Page params={{ eventId }} />);
}

async function composeEmail() {
  fireEvent.click(
    await screen.findByRole('button', { name: /new (message|blast)/i })
  );
  fireEvent.change(screen.getByLabelText(/channel/i), {
    target: { value: 'EMAIL' },
  });
  fireEvent.change(screen.getByLabelText(/audience/i), {
    target: { value: 'APPROVED' },
  });
  fireEvent.change(screen.getByLabelText(/subject/i), {
    target: { value: 'Tomorrow’s build night' },
  });
  fireEvent.change(screen.getByLabelText(/message|body/i), {
    target: { value: 'Doors open at 9:30.' },
  });
}

describe('/organizer/events/[eventId]/communications', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseTheme.mockReturnValue({ isDarkMode: false });
    mockCommunicationFetch();
  });

  it('shows provider availability and disables SMS until provider and consent configuration are active', async () => {
    renderPage();

    expect(await screen.findByText(/email.*available/i)).toBeInTheDocument();
    expect(screen.getByText(/sms.*unavailable/i)).toBeInTheDocument();
    expect(screen.getByText(/active consent copy/i)).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /sms/i })).toBeDisabled();
  });

  it('composes an email with channel, audience, subject, and body', async () => {
    renderPage();
    await composeEmail();

    fireEvent.click(
      screen.getByRole('button', { name: /save.*preview|preview/i })
    );
    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        `/api/events/${eventId}/blasts`,
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('Tomorrow’s build night'),
        })
      )
    );
  });

  it('shows eligible and aggregate exclusion counts and requires explicit confirmation', async () => {
    renderPage();
    await composeEmail();
    fireEvent.click(
      screen.getByRole('button', { name: /save.*preview|preview/i })
    );

    expect(await screen.findByText(/42.*eligible/i)).toBeInTheDocument();
    expect(screen.getByText(/1.*missing contact/i)).toBeInTheDocument();
    expect(screen.getByText(/3.*preference/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /confirm.*send/i })
    ).toBeInTheDocument();
  });

  it('replaces stale confirmation after a 409 and requires reconfirmation', async () => {
    mockCommunicationFetch({ changedAudience: true });
    renderPage();
    await composeEmail();
    fireEvent.click(
      screen.getByRole('button', { name: /save.*preview|preview/i })
    );
    fireEvent.click(
      await screen.findByRole('button', { name: /confirm.*send/i })
    );

    expect(await screen.findByText(/audience changed/i)).toBeInTheDocument();
    expect(screen.getByText(/41.*eligible/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /confirm.*send/i })
    ).toBeInTheDocument();
  });

  it('shows immutable history summary and recipient-level delivery details', async () => {
    renderPage();

    expect(
      await screen.findByText(/tomorrow’s build night/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/40.*sent/i)).toBeInTheDocument();
    expect(screen.getByText(/2.*failed/i)).toBeInTheDocument();
    expect(screen.getByText(/morgan mc/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /view details/i }));

    expect(await screen.findByText(/ada builder/i)).toBeInTheDocument();
    expect(screen.getByText(/grace builder/i)).toBeInTheDocument();
    expect(
      screen.getByText(/provider rejected destination/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /edit sent/i })
    ).not.toBeInTheDocument();
  });
});
