import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mockUseTheme = jest.fn();

jest.mock('../../src/app/contexts/ThemeContext', () => ({
  useTheme: () => mockUseTheme(),
}));

jest.mock('../../src/app/components/OrganizerNotePanel', () => {
  return function MockOrganizerNotePanel({ title }: { title: string }) {
    return <div data-testid="organizer-note-panel">{title}</div>;
  };
});

jest.mock('next/navigation', () => ({
  usePathname: () => '/organizer/events/event-ai-build-night/settings',
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
  }),
}));

type PageComponent = React.ComponentType<{ params: { eventId: string } }>;

const eventSettings = {
  id: 'event-ai-build-night',
  title: 'AI Build Night',
  slug: 'ai-build-night',
  visibility: 'PUBLIC',
  status: 'PUBLISHED',
  publicStatus: 'OPEN',
  chapter: {
    id: 'chapter-boston',
    name: 'Sundai Boston',
    slug: 'boston',
    timezone: 'America/New_York',
  },
  description: 'Public builder night description.',
  publicLocation: 'Boston, MA',
  publicProgramLabel: 'Prototype sprint',
  publicSponsorText: 'Hosted with public sponsor copy.',
  publicExpertText: 'Public expert context.',
  approvedDetailsJson: {
    address: '123 Private Lab Street',
    doorCode: 'Blue door code 2468',
    toolkitUrl: 'https://example.com/private-toolkit',
  },
  capacity: 40,
  approvedCount: 32,
  applicationMode: 'REQUIRES_APPROVAL',
  applicationsOpen: true,
  applicationsClosedAt: null,
  applicationsCloseReason: null,
  autoPromoteWaitlist: false,
  confirmationMessage: 'You are approved for AI Build Night.',
  waitlistMessage: 'You are on the waitlist for AI Build Night.',
  declineMessage: 'We cannot accommodate this application.',
  staff: [
    {
      id: 'staff-mc',
      role: 'MC',
      hacker: {
        id: 'hacker-mc',
        name: 'Morgan MC',
      },
    },
  ],
};

const closedEventSettings = {
  ...eventSettings,
  applicationsOpen: false,
  applicationsClosedAt: '2026-07-01T18:30:00.000Z',
  applicationsCloseReason: 'Capacity reached for this format',
  autoPromoteWaitlist: true,
  publicStatus: 'CLOSED',
};

function loadPage(route: string, modulePath: string): PageComponent {
  try {
    const mod = require(modulePath);
    if (!mod.default) {
      throw new Error('module did not export a default React component');
    }

    return mod.default;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Expected ${route} page module at ${modulePath}: ${message}`
    );
  }
}

function jsonResponse(data: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(data),
    text: jest
      .fn()
      .mockResolvedValue(
        typeof data === 'string' ? data : JSON.stringify(data)
      ),
  });
}

function requestUrl(input: RequestInfo | URL) {
  if (typeof input === 'string') return input;
  if ('url' in input) return input.url;
  return input.toString();
}

function mockEventFetch(event = eventSettings) {
  global.fetch = jest.fn((input: RequestInfo | URL) => {
    const url = requestUrl(input);

    if (url === `/api/events/${event.id}?management=true`) {
      return jsonResponse(event);
    }

    return jsonResponse({});
  }) as jest.Mock;
}

function mockForbiddenFetch() {
  global.fetch = jest.fn(() =>
    jsonResponse(
      { error: 'You do not have permission to view this page.' },
      403
    )
  ) as jest.Mock;
}

function renderSettingsPage(eventId = eventSettings.id) {
  const OrganizerEventSettingsPage = loadPage(
    '/organizer/events/[eventId]/settings',
    '../../src/app/organizer/events/[eventId]/settings/page'
  );

  render(<OrganizerEventSettingsPage params={{ eventId }} />);
}

function patchBodyForEvent(eventId = eventSettings.id) {
  const patchCall = (global.fetch as jest.Mock).mock.calls.find(
    ([input, init]: [RequestInfo | URL, RequestInit | undefined]) =>
      requestUrl(input) === `/api/events/${eventId}` &&
      init?.method === 'PATCH'
  );

  if (!patchCall) return null;

  const body = patchCall[1]?.body;
  return typeof body === 'string' ? JSON.parse(body) : null;
}

async function expectSomeText(...patterns: RegExp[]) {
  await waitFor(() => {
    expect(
      patterns.some(pattern => screen.queryAllByText(pattern).length > 0)
    ).toBe(true);
  });
}

describe('/organizer/events/[eventId]/settings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseTheme.mockReturnValue({ isDarkMode: false });
    mockEventFetch();
  });

  it('shows application mode, capacity, waitlist toggle state, and public status for authorized organizers', async () => {
    renderSettingsPage();

    await expectSomeText(/ai build night/i);
    await expectSomeText(/requires approval/i, /approval required/i);
    await expectSomeText(/applications? open/i, /open for applications/i);
    await expectSomeText(/capacity/i);
    await expectSomeText(/40/i);
    await expectSomeText(/32/i);
    await expectSomeText(/auto-promote waitlist/i, /waitlist auto-promotion/i);

    const waitlistToggle = screen.getByRole('checkbox', {
      name: /auto-promote waitlist|waitlist auto-promotion/i,
    });
    expect(waitlistToggle).not.toBeChecked();
  });

  it('shows closed application state and close reason separately from published visibility', async () => {
    mockEventFetch(closedEventSettings);

    renderSettingsPage();

    await expectSomeText(/published/i, /public/i);
    await expectSomeText(/applications? closed/i, /closed for applications/i);
    await expectSomeText(/capacity reached for this format/i);

    const waitlistToggle = screen.getByRole('checkbox', {
      name: /auto-promote waitlist|waitlist auto-promotion/i,
    });
    expect(waitlistToggle).toBeChecked();
  });

  it('saves close controls and auto-promote waitlist toggle changes from organizer settings', async () => {
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = requestUrl(input);

      if (url === `/api/events/${eventSettings.id}?management=true`) {
        return jsonResponse(eventSettings);
      }

      if (
        url === `/api/events/${eventSettings.id}` &&
        init?.method === 'PATCH'
      ) {
        return jsonResponse({
          ...eventSettings,
          applicationsOpen: false,
          autoPromoteWaitlist: true,
        });
      }

      return jsonResponse({});
    }) as jest.Mock;

    renderSettingsPage();

    const applicationsOpenToggle = await screen.findByRole('checkbox', {
      name: /applications open/i,
    });
    expect(applicationsOpenToggle).toBeChecked();
    expect(screen.getByText(/capacity 40, 32 approved/i)).toBeInTheDocument();

    fireEvent.click(applicationsOpenToggle);
    fireEvent.click(
      screen.getByRole('checkbox', {
        name: /auto-promote waitlist|waitlist auto-promotion/i,
      })
    );
    fireEvent.click(screen.getByRole('button', { name: /save settings/i }));

    await waitFor(() => {
      expect(patchBodyForEvent()).toEqual(
        expect.objectContaining({
          applicationsOpen: false,
          autoPromoteWaitlist: true,
        })
      );
    });
  });

  it('shows close reason and saves reopen controls with auto-promote disabled', async () => {
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = requestUrl(input);

      if (url === `/api/events/${closedEventSettings.id}?management=true`) {
        return jsonResponse(closedEventSettings);
      }

      if (
        url === `/api/events/${closedEventSettings.id}` &&
        init?.method === 'PATCH'
      ) {
        return jsonResponse({
          ...closedEventSettings,
          applicationsOpen: true,
          autoPromoteWaitlist: false,
        });
      }

      return jsonResponse({});
    }) as jest.Mock;

    renderSettingsPage(closedEventSettings.id);

    const applicationsOpenToggle = await screen.findByRole('checkbox', {
      name: /applications open/i,
    });
    expect(applicationsOpenToggle).not.toBeChecked();
    expect(screen.getByText(/capacity 40, 32 approved/i)).toBeInTheDocument();
    expect(
      screen.getByText(/applications closed.*capacity reached for this format/i)
    ).toBeInTheDocument();

    fireEvent.click(applicationsOpenToggle);
    fireEvent.click(
      screen.getByRole('checkbox', {
        name: /auto-promote waitlist|waitlist auto-promotion/i,
      })
    );
    fireEvent.click(screen.getByRole('button', { name: /save settings/i }));

    await waitFor(() => {
      expect(patchBodyForEvent(closedEventSettings.id)).toEqual(
        expect.objectContaining({
          applicationsOpen: true,
          autoPromoteWaitlist: false,
        })
      );
    });
  });

  it('renders public details and approved-only details as separate editable fields', async () => {
    renderSettingsPage();

    await expectSomeText(/public details/i, /public event details/i);
    await expectSomeText(/approved-only details/i, /approved attendees only/i);

    expect(
      screen.getByLabelText(
        /public description|description visible to everyone/i
      )
    ).toHaveValue('Public builder night description.');
    expect(screen.getByLabelText(/public location/i)).toHaveValue('Boston, MA');
    expect(
      screen.getByLabelText(/approved-only address|private address/i)
    ).toHaveValue('123 Private Lab Street');
    expect(screen.getByLabelText(/door code/i)).toHaveValue(
      'Blue door code 2468'
    );
    expect(screen.getByLabelText(/toolkit/i)).toHaveValue(
      'https://example.com/private-toolkit'
    );
  });

  it('saves authorized edits to application mode, waitlist, public details, and approved-only details', async () => {
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = requestUrl(input);

      if (url === `/api/events/${eventSettings.id}?management=true`) {
        return jsonResponse(eventSettings);
      }

      if (
        url === `/api/events/${eventSettings.id}` &&
        init?.method === 'PATCH'
      ) {
        return jsonResponse({
          ...eventSettings,
          title: 'Updated AI Build Night',
        });
      }

      return jsonResponse({});
    }) as jest.Mock;

    renderSettingsPage();

    const titleInput = await screen.findByLabelText(/title/i);
    fireEvent.change(titleInput, {
      target: { value: 'Updated AI Build Night' },
    });
    fireEvent.change(
      screen.getByLabelText(/application mode|registration mode/i),
      { target: { value: 'OPEN_RSVP' } }
    );
    fireEvent.click(
      screen.getByRole('checkbox', {
        name: /auto-promote waitlist|waitlist auto-promotion/i,
      })
    );
    fireEvent.change(screen.getByLabelText(/public location/i), {
      target: { value: 'Cambridge, MA' },
    });
    fireEvent.change(
      screen.getByLabelText(/approved-only address|private address/i),
      {
        target: { value: '456 Approved Attendee Way' },
      }
    );

    fireEvent.click(screen.getByRole('button', { name: /save settings/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        `/api/events/${eventSettings.id}`,
        expect.objectContaining({
          method: 'PATCH',
          body: expect.stringContaining('"applicationMode":"OPEN_RSVP"'),
        })
      );
    });
    expect(global.fetch).toHaveBeenCalledWith(
      `/api/events/${eventSettings.id}`,
      expect.objectContaining({
        body: expect.stringContaining('"autoPromoteWaitlist":true'),
      })
    );
    expect(global.fetch).toHaveBeenCalledWith(
      `/api/events/${eventSettings.id}`,
      expect.objectContaining({
        body: expect.stringContaining('"publicLocation":"Cambridge, MA"'),
      })
    );
    expect(global.fetch).toHaveBeenCalledWith(
      `/api/events/${eventSettings.id}`,
      expect.objectContaining({
        body: expect.stringContaining('"approvedDetailsJson"'),
      })
    );
  });

  it('denies event settings controls when the management read is forbidden', async () => {
    mockForbiddenFetch();

    renderSettingsPage();

    await expectSomeText(/you do not have permission/i, /forbidden/i);
    expect(screen.queryByLabelText(/title/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('checkbox', {
        name: /auto-promote waitlist|waitlist auto-promotion/i,
      })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /save settings/i })
    ).not.toBeInTheDocument();
  });
});
