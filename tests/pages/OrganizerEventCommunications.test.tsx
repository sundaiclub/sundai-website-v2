import React from 'react';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';

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

function mockCommunicationFetch({
  changedAudience = false,
  smsAvailable = false,
  chapterInvitationStatus = null as null | {
    id: string;
    channel: 'EMAIL' | 'SMS';
    status: string;
    recipientCount: number;
    sentCount: number;
    failedCount: number;
    sentAt: string;
  },
} = {}) {
  global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = requestUrl(input);
    if (url === `/api/events/${eventId}/blasts` && !init?.method) {
      return jsonResponse({
        items: [sentCommunication],
        chapterInvitationStatus,
        providerAvailability: {
          email: { available: true },
          sms: smsAvailable
            ? { available: true }
            : {
                available: false,
                reason:
                  'SMS requires provider configuration and active consent copy.',
              },
        },
      });
    }
    if (url === `/api/events/${eventId}/blasts/invitation`) {
      return jsonResponse({
        subject: "You're invited to AI Build Night",
        emailBody: 'Join Sundai Boston for AI Build Night.',
        smsBody: "Sundai Boston: You're invited to AI Build Night.",
      });
    }
    if (url === `/api/events/${eventId}/blasts` && init?.method === 'POST') {
      const body = JSON.parse(String(init.body));
      return jsonResponse(
        {
          id: `blast-draft-${String(body.channel).toLowerCase()}`,
          status: 'DRAFT',
          ...body,
        },
        201
      );
    }
    if (url.includes('/blasts/blast-draft-') && url.endsWith('/preview')) {
      return jsonResponse({
        channel: url.includes('blast-draft-sms') ? 'SMS' : 'EMAIL',
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
    if (url.includes('/blasts/blast-draft-') && url.endsWith('/send')) {
      if (changedAudience) {
        return jsonResponse(
          {
            error: 'Audience changed',
            preview: {
              channel: url.includes('blast-draft-sms') ? 'SMS' : 'EMAIL',
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
      return jsonResponse({
        ...sentCommunication,
        id: url.includes('blast-draft-sms')
          ? 'blast-draft-sms'
          : 'blast-draft-email',
        channel: url.includes('blast-draft-sms') ? 'SMS' : 'EMAIL',
        subject: url.includes('blast-draft-sms')
          ? null
          : sentCommunication.subject,
      });
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
  await screen.findByRole('checkbox', { name: /email/i });
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
    expect(screen.getByRole('checkbox', { name: /^sms$/i })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: /^sms$/i })).not.toBeChecked();
    expect(screen.getByText(/invitation not sent/i)).toBeInTheDocument();
  });

  it('shows when a chapter invitation was already sent', async () => {
    mockCommunicationFetch({
      chapterInvitationStatus: {
        id: 'chapter-invitation-email',
        channel: 'EMAIL',
        status: 'SENT',
        recipientCount: 6,
        sentCount: 6,
        failedCount: 0,
        sentAt: '2026-09-04T18:50:00.000Z',
      },
    });
    renderPage();

    const status = await screen.findByText(/^invitation sent$/i);
    const inviteSection = screen.getByRole('heading', {
      name: /invite chapter members/i,
    });

    expect(status).toBeInTheDocument();
    expect(
      status.compareDocumentPosition(inviteSection) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(screen.getByText(/6 sent.*0 failed.*email/i)).toBeInTheDocument();
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

  it('uses checkboxes for combined channels and registration-status audiences', async () => {
    mockCommunicationFetch({ smsAvailable: true });
    renderPage();

    const email = await screen.findByRole('checkbox', { name: /^email$/i });
    const sms = screen.getByRole('checkbox', { name: /^sms$/i });
    expect(email).toBeChecked();
    expect(sms).toBeChecked();
    fireEvent.click(screen.getByRole('checkbox', { name: /pending/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /waitlisted/i }));
    fireEvent.change(screen.getByLabelText(/subject/i), {
      target: { value: 'Build night update' },
    });
    fireEvent.change(screen.getByLabelText(/message body/i), {
      target: { value: 'Doors open at 9:30.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save.*preview/i }));

    await waitFor(() => {
      const createCalls = (global.fetch as jest.Mock).mock.calls.filter(
        ([url, init]) =>
          url === `/api/events/${eventId}/blasts` && init?.method === 'POST'
      );
      expect(createCalls).toHaveLength(2);
      expect(createCalls.map(([, init]) => JSON.parse(init.body))).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            channel: 'EMAIL',
            audienceDefinition: {
              statuses: ['APPROVED', 'PENDING', 'WAITLISTED'],
            },
          }),
          expect.objectContaining({
            channel: 'SMS',
            subject: null,
          }),
        ])
      );
    });
    expect(screen.getByText(/subject is only used for emails/i)).toBeVisible();
    expect(
      screen.queryByRole('button', { name: /new message/i })
    ).not.toBeInTheDocument();
  });

  it('opens a separate modal to review and confirm chapter invitations', async () => {
    mockCommunicationFetch({ smsAvailable: true });
    renderPage();

    fireEvent.click(
      await screen.findByRole('button', { name: /invite chapter members/i })
    );
    const dialog = await screen.findByRole('dialog', {
      name: /confirm chapter invitation/i,
    });
    expect(
      within(dialog).getByText(/review the message and eligible recipients/i)
    ).toBeInTheDocument();

    await waitFor(() => {
      const createCalls = (global.fetch as jest.Mock).mock.calls.filter(
        ([url, init]) =>
          url === `/api/events/${eventId}/blasts` && init?.method === 'POST'
      );
      expect(createCalls).toHaveLength(2);
      expect(createCalls.map(([, init]) => JSON.parse(init.body))).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            channel: 'EMAIL',
            audienceType: 'CHAPTER_MEMBERS',
            subject: "You're invited to AI Build Night",
          }),
          expect.objectContaining({
            channel: 'SMS',
            audienceType: 'CHAPTER_MEMBERS',
            subject: null,
          }),
        ])
      );
    });
    const confirm = await within(dialog).findByRole('button', {
      name: /confirm and send invitation/i,
    });
    expect(confirm).toBeInTheDocument();
    fireEvent.click(confirm);

    await waitFor(() => {
      const sendCalls = (global.fetch as jest.Mock).mock.calls.filter(
        ([url]) => url.includes('/blasts/blast-draft-') && url.endsWith('/send')
      );
      expect(sendCalls).toHaveLength(2);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(screen.getByText(/chapter invitation sent/i)).toBeInTheDocument();
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
