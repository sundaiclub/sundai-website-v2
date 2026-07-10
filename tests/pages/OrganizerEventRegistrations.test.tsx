import React from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

import type {
  OrganizerRegistrationReviewCapabilities,
  OrganizerRegistrationReviewRow,
  OrganizerRegistrationReviewState,
  OrganizerReviewRole,
  RegistrationStatus,
} from '../../src/types/event-management';

const mockUseTheme = jest.fn();
const mockUseUserContext = jest.fn();

jest.mock('../../src/app/contexts/ThemeContext', () => ({
  useTheme: () => mockUseTheme(),
}));

jest.mock('../../src/app/contexts/UserContext', () => ({
  useUserContext: () => mockUseUserContext(),
}));

jest.mock('next/navigation', () => ({
  usePathname: () => '/organizer/events/event-ai-build-night/registrations',
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

const eventId = 'event-ai-build-night';

const eventSummary = {
  id: eventId,
  title: 'AI Build Night',
  slug: 'ai-build-night',
  status: 'PUBLISHED',
  visibility: 'PUBLIC',
  applicationMode: 'REQUIRES_APPROVAL',
  applicationsOpen: true,
  capacity: 40,
  approvedCount: 12,
  chapter: {
    id: 'chapter-boston',
    name: 'Sundai Boston',
    slug: 'boston',
    timezone: 'America/New_York',
  },
};

const decisionCapabilities: OrganizerRegistrationReviewCapabilities = {
  canView: true,
  canDecide: true,
  canApprove: true,
  canWaitlist: true,
  canDecline: true,
  canCancel: true,
  canEditInternalNotes: true,
  canViewBanContext: false,
};

const noteOnlyCapabilities: OrganizerRegistrationReviewCapabilities = {
  canView: true,
  canDecide: false,
  canApprove: false,
  canWaitlist: false,
  canDecline: false,
  canCancel: false,
  canEditInternalNotes: true,
  canViewBanContext: false,
};

const siteAdminCapabilities: OrganizerRegistrationReviewCapabilities = {
  ...decisionCapabilities,
  canViewBanContext: true,
};

const pendingRow: OrganizerRegistrationReviewRow = {
  id: 'registration-pending',
  eventId,
  hackerId: 'hacker-applicant',
  status: 'PENDING',
  source: 'WEBSITE',
  applicant: {
    id: 'hacker-applicant',
    name: 'Signed In Applicant',
    username: 'signedinapplicant',
    email: 'applicant@example.com',
    role: 'HACKER',
  },
  answersJson: {
    name: 'Signed In Applicant',
    email: 'applicant@example.com',
    why_this_event: 'I want to build with the Boston AI community.',
    project_url: 'https://example.com/applicant-project',
  },
  templateSnapshotJson: [
    {
      id: 'name',
      label: 'Name',
      type: 'TEXT',
      required: true,
      order: 1,
    },
    {
      id: 'email',
      label: 'Email',
      type: 'EMAIL',
      required: true,
      order: 2,
    },
    {
      id: 'why_this_event',
      label: 'Why do you want to join this event?',
      type: 'TEXTAREA',
      required: true,
      order: 10,
    },
    {
      id: 'project_url',
      label: 'Project URL',
      type: 'URL',
      required: false,
      order: 20,
    },
  ],
  publicSafeMessage: null,
  internalReviewNotes: 'Ask about available GPUs before approving.',
  organizerNoteBody: 'Strong previous Sundai contributor.',
  submittedAt: '2026-06-22T16:00:00.000Z',
  decidedAt: null,
  decidedBy: null,
  cancelledAt: null,
  cancelledBy: null,
  activeBan: null,
  capabilities: decisionCapabilities,
};

const approvedRow: OrganizerRegistrationReviewRow = {
  ...pendingRow,
  id: 'registration-approved',
  hackerId: 'hacker-approved',
  status: 'APPROVED',
  applicant: {
    id: 'hacker-approved',
    name: 'Approved Applicant',
    username: 'approvedapplicant',
    email: 'approved@example.com',
    role: 'HACKER',
  },
  publicSafeMessage: 'You are approved for AI Build Night.',
  decidedAt: '2026-06-22T18:00:00.000Z',
  decidedBy: { id: 'hacker-mc', name: 'Morgan MC' },
};

const waitlistedRow: OrganizerRegistrationReviewRow = {
  ...pendingRow,
  id: 'registration-waitlisted',
  hackerId: 'hacker-waitlisted',
  status: 'WAITLISTED',
  applicant: {
    id: 'hacker-waitlisted',
    name: 'Waitlisted Applicant',
    username: 'waitlistedapplicant',
    email: 'waitlisted@example.com',
    role: 'HACKER',
  },
  publicSafeMessage: 'You are on the waitlist for AI Build Night.',
};

const declinedRow: OrganizerRegistrationReviewRow = {
  ...pendingRow,
  id: 'registration-declined',
  hackerId: 'hacker-declined',
  status: 'DECLINED',
  applicant: {
    id: 'hacker-declined',
    name: 'Declined Applicant',
    username: 'declinedapplicant',
    email: 'declined@example.com',
    role: 'HACKER',
  },
  publicSafeMessage: 'We cannot accommodate this application.',
};

const cancelledRow: OrganizerRegistrationReviewRow = {
  ...pendingRow,
  id: 'registration-cancelled',
  hackerId: 'hacker-cancelled',
  status: 'CANCELLED',
  applicant: {
    id: 'hacker-cancelled',
    name: 'Cancelled Applicant',
    username: 'cancelledapplicant',
    email: 'cancelled@example.com',
    role: 'HACKER',
  },
  cancelledAt: '2026-06-23T12:00:00.000Z',
};

const blockedBannedRow: OrganizerRegistrationReviewRow = {
  ...pendingRow,
  id: 'registration-blocked-banned',
  hackerId: 'hacker-banned',
  status: 'BLOCKED',
  applicant: {
    id: 'hacker-banned',
    name: 'Banned Applicant',
    username: 'bannedapplicant',
    email: 'banned@example.com',
    role: 'HACKER',
  },
  answersJson: null,
  templateSnapshotJson: null,
  publicSafeMessage: 'You are unable to register for this event at this time.',
  internalReviewNotes: 'Active global ban; visible to site admins only.',
  organizerNoteBody: 'Do not expose this moderation context to organizers.',
  activeBan: {
    id: 'ban-active',
    publicSafeReason: 'You are unable to register for this event at this time.',
    createdAt: '2026-05-25T12:00:00.000Z',
  },
  capabilities: siteAdminCapabilities,
};

const defaultRowsByStatus: Record<
  RegistrationStatus,
  OrganizerRegistrationReviewRow[]
> = {
  PENDING: [pendingRow],
  APPROVED: [approvedRow],
  WAITLISTED: [waitlistedRow],
  DECLINED: [declinedRow],
  CANCELLED: [cancelledRow],
  BLOCKED: [],
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

function parseRequestUrl(input: RequestInfo | URL) {
  return new URL(requestUrl(input), 'http://localhost');
}

function reviewState({
  includeBannedUsers,
  rows,
  statusFilter,
  viewerRole,
}: {
  includeBannedUsers: boolean;
  rows: OrganizerRegistrationReviewRow[];
  statusFilter: RegistrationStatus;
  viewerRole: OrganizerReviewRole;
}): OrganizerRegistrationReviewState {
  return {
    eventId,
    statusFilter,
    includeBannedUsers,
    viewerRole,
    counts: Object.fromEntries(
      Object.entries(defaultRowsByStatus).map(([status, statusRows]) => [
        status,
        statusRows.length,
      ])
    ),
    rows,
  };
}

function mockRegistrationReviewFetch({
  rowsByStatus = defaultRowsByStatus,
  viewerRole = 'MC',
  includeBlockedForSiteAdmin = false,
}: {
  rowsByStatus?: Record<RegistrationStatus, OrganizerRegistrationReviewRow[]>;
  viewerRole?: OrganizerReviewRole;
  includeBlockedForSiteAdmin?: boolean;
} = {}) {
  global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = parseRequestUrl(input);

    if (
      url.pathname === `/api/events/${eventId}` &&
      url.search === '?management=true'
    ) {
      return jsonResponse(eventSummary);
    }

    if (
      url.pathname ===
        `/api/events/${eventId}/registrations/${pendingRow.id}/notes` &&
      init?.method === 'PATCH'
    ) {
      return jsonResponse({
        ...pendingRow,
        internalReviewNotes: JSON.parse(String(init.body)).internalReviewNotes,
      });
    }

    if (
      url.pathname ===
        `/api/events/${eventId}/registrations/${pendingRow.id}` &&
      init?.method === 'PATCH'
    ) {
      const body = JSON.parse(String(init.body));
      return jsonResponse({
        ...pendingRow,
        status: body.status,
      });
    }

    if (url.pathname === `/api/events/${eventId}/registrations`) {
      const includeBannedUsers =
        url.searchParams.get('includeBannedUsers') === 'true';
      const statusFilter = (url.searchParams.get('status') ??
        'PENDING') as RegistrationStatus;
      const statusRows = rowsByStatus[statusFilter] ?? [];
      const rows =
        includeBannedUsers && includeBlockedForSiteAdmin
          ? [...statusRows, blockedBannedRow]
          : statusRows;

      return jsonResponse(
        reviewState({
          includeBannedUsers,
          rows,
          statusFilter,
          viewerRole,
        })
      );
    }

    return jsonResponse({});
  }) as jest.Mock;
}

function renderRegistrationsPage() {
  const OrganizerEventRegistrationsPage = loadPage(
    '/organizer/events/[eventId]/registrations',
    '../../src/app/organizer/events/[eventId]/registrations/page'
  );

  render(<OrganizerEventRegistrationsPage params={{ eventId }} />);
}

function latestFetchBody(pathPattern: RegExp) {
  const call = (global.fetch as jest.Mock).mock.calls.find(([input]) =>
    pathPattern.test(requestUrl(input))
  );

  if (!call) {
    throw new Error(`Expected fetch matching ${pathPattern}`);
  }

  return JSON.parse(String(call[1]?.body ?? '{}'));
}

describe('/organizer/events/[eventId]/registrations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseTheme.mockReturnValue({ isDarkMode: false });
    mockUseUserContext.mockReturnValue({
      isAdmin: false,
      loading: false,
      userInfo: {
        id: 'hacker-mc',
        name: 'Morgan MC',
        email: 'mc@example.com',
        role: 'HACKER',
      },
    });
    mockRegistrationReviewFetch();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders registration queue tabs and applicant answers for the active status', async () => {
    renderRegistrationsPage();

    expect(await screen.findByText(/signed in applicant/i)).toBeInTheDocument();

    for (const label of [
      /pending/i,
      /approved/i,
      /waitlisted/i,
      /declined/i,
      /cancelled/i,
    ]) {
      expect(screen.getByRole('tab', { name: label })).toBeInTheDocument();
    }
    for (const status of [
      'pending',
      'approved',
      'waitlisted',
      'declined',
      'cancelled',
    ]) {
      expect(
        screen.getByRole('tab', { name: new RegExp(`${status} 1`, 'i') })
      ).toBeInTheDocument();
    }

    expect(screen.getByText(/applicant@example.com/i)).toBeInTheDocument();
    expect(
      screen.getByText(/why do you want to join this event/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/i want to build with the boston ai community/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/project url/i)).toBeInTheDocument();
    expect(
      screen.getByText('https://example.com/applicant-project')
    ).toBeInTheDocument();
    expect(
      screen.getByText(/strong previous sundai contributor/i)
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /approved/i }));

    expect(await screen.findByText(/approved applicant/i)).toBeInTheDocument();
    expect(screen.queryByText(/signed in applicant/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /^approve$/i })
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^waitlist$/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /^decline$/i })).toBeEnabled();

    await waitFor(() => {
      const urls = (global.fetch as jest.Mock).mock.calls.map(([input]) =>
        requestUrl(input)
      );

      expect(urls).toEqual(
        expect.arrayContaining([
          expect.stringMatching(
            /\/api\/events\/event-ai-build-night\/registrations\?.*status=APPROVED/
          ),
        ])
      );
    });

    fireEvent.click(screen.getByRole('tab', { name: /waitlisted/i }));
    expect(
      await screen.findByText(/waitlisted applicant/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /^waitlist$/i })
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /declined/i }));
    expect(await screen.findByText(/declined applicant/i)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /^decline$/i })
    ).not.toBeInTheDocument();
  });

  it('saves event-specific internal review notes without mixing them with public messages', async () => {
    renderRegistrationsPage();

    const notes = await screen.findByLabelText(/internal review notes/i);
    expect(notes).toHaveValue('Ask about available GPUs before approving.');

    fireEvent.change(notes, {
      target: { value: 'Confirmed GPU access and mentor match.' },
    });
    expect(screen.getByText(/unsaved changes/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        `/api/events/${eventId}/registrations/${pendingRow.id}/notes`,
        expect.objectContaining({ method: 'PATCH' })
      );
    });

    expect(
      latestFetchBody(/\/registrations\/registration-pending\/notes$/)
    ).toMatchObject({
      internalReviewNotes: 'Confirmed GPU access and mentor match.',
    });
    expect(
      latestFetchBody(/\/registrations\/registration-pending\/notes$/)
    ).not.toHaveProperty('publicSafeMessage');
    expect(await screen.findByText(/saved successfully/i)).toBeInTheDocument();
    expect(screen.queryByText(/unsaved changes/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^save$/i })).toBeDisabled();
  });

  it('shows decision controls to MCs but hides them from note-only co-MCs', async () => {
    renderRegistrationsPage();

    expect(await screen.findByText(/signed in applicant/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /approve/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /waitlist/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /decline/i })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: /approve/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        `/api/events/${eventId}/registrations/${pendingRow.id}`,
        expect.objectContaining({ method: 'PATCH' })
      );
    });
    expect(
      latestFetchBody(/\/registrations\/registration-pending$/)
    ).toMatchObject({
      status: 'APPROVED',
    });
    await waitFor(() => {
      expect(
        screen.queryByText(/signed in applicant/i)
      ).not.toBeInTheDocument();
    });
    expect(
      screen.getByText(/no registrations in this queue/i)
    ).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /pending 0/i })).toBeInTheDocument();
    expect(
      screen.getByRole('tab', { name: /approved 2/i })
    ).toBeInTheDocument();

    cleanup();
    mockRegistrationReviewFetch({
      viewerRole: 'CO_MC',
      rowsByStatus: {
        ...defaultRowsByStatus,
        PENDING: [{ ...pendingRow, capabilities: noteOnlyCapabilities }],
      },
    });

    renderRegistrationsPage();

    expect(await screen.findByText(/signed in applicant/i)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /approve/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /waitlist/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /decline/i })
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText(/internal review notes/i)).toBeEnabled();
  });

  it('keeps globally banned applicants and moderation signals hidden from non-site-admin queues', async () => {
    mockRegistrationReviewFetch({
      rowsByStatus: {
        ...defaultRowsByStatus,
        PENDING: [pendingRow],
      },
      includeBlockedForSiteAdmin: true,
      viewerRole: 'CHAPTER_ADMIN',
    });

    renderRegistrationsPage();

    expect(await screen.findByText(/signed in applicant/i)).toBeInTheDocument();
    expect(screen.queryByText(/banned applicant/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/active global ban/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/unable to register/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/include banned/i)).not.toBeInTheDocument();

    const registrationListCalls = (global.fetch as jest.Mock).mock.calls
      .map(([input]) => requestUrl(input))
      .filter(url => url.includes(`/api/events/${eventId}/registrations`));

    expect(registrationListCalls).not.toEqual(
      expect.arrayContaining([
        expect.stringContaining('includeBannedUsers=true'),
      ])
    );
  });

  it('lets site admins enter the include-banned context and see blocked applicant ban context', async () => {
    mockUseUserContext.mockReturnValue({
      isAdmin: true,
      loading: false,
      userInfo: {
        id: 'hacker-site-admin',
        name: 'Site Admin',
        email: 'site-admin@example.com',
        role: 'SITE_ADMIN',
      },
    });
    mockRegistrationReviewFetch({
      includeBlockedForSiteAdmin: true,
      viewerRole: 'SITE_ADMIN',
    });

    renderRegistrationsPage();

    const includeBanned = await screen.findByRole('checkbox', {
      name: /include banned|show banned/i,
    });
    fireEvent.click(includeBanned);

    expect(await screen.findByText(/banned applicant/i)).toBeInTheDocument();
    expect(screen.getByText(/blocked/i)).toBeInTheDocument();
    expect(screen.getByText(/active global ban/i)).toBeInTheDocument();
    expect(screen.getByText(/unable to register/i)).toBeInTheDocument();

    await waitFor(() => {
      const urls = (global.fetch as jest.Mock).mock.calls.map(([input]) =>
        requestUrl(input)
      );

      expect(urls).toEqual(
        expect.arrayContaining([
          expect.stringMatching(
            /\/api\/events\/event-ai-build-night\/registrations\?.*includeBannedUsers=true/
          ),
        ])
      );
    });
  });
});
