import React from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
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
  useParams: () => ({ eventId: 'event-ai-build-night' }),
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

type PageComponent = React.ComponentType;
type WorkspaceLayoutComponent = React.ComponentType<{
  children: React.ReactNode;
}>;

const eventId = 'event-ai-build-night';

const workspaceSummary = {
  event: {
    id: eventId,
    title: 'AI Build Night',
    status: 'PUBLISHED',
    chapter: {
      id: 'chapter-boston',
      name: 'Sundai Boston',
      slug: 'boston',
    },
    startTime: '2026-07-18T14:00:00.000Z',
    endTime: '2026-07-18T22:00:00.000Z',
    capacity: 40,
    applicationMode: 'REQUIRES_APPROVAL',
    applicationsOpen: true,
    autoPromoteWaitlist: true,
    trackAttendance: false,
    publicUrl: '/events/boston/ai-build-night',
    hasApprovedOnlyDetails: true,
  },
  capabilities: {
    administerEvent: false,
    editEventSettings: true,
    assignStaff: false,
    decideApplicants: true,
    manageOperations: true,
    sendCommunications: true,
    manageMaterials: true,
    managePitch: true,
    editNotes: true,
    viewNoteHistory: false,
  },
  staff: [],
  counts: {
    registrations: {
      pending: 1,
      approved: 1,
      waitlisted: 1,
      declined: 1,
      cancelled: 1,
    },
    checkIn: null,
    projects: { total: 0, submittedCards: 0 },
    pitch: { queued: 0, pitched: 0, highlighted: 0 },
    materials: 0,
    communications: 0,
  },
  availableSections: [
    'overview',
    'registrations',
    'communications',
    'materials',
    'projects',
    'pitch',
    'notes',
    'reporting',
  ],
  unavailable: ['attendance', 'noShows'],
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
  applicantHistory: {
    otherEventsApplied: 4,
    otherEventsAccepted: 3,
    publicProjects: 1,
  },
  answersJson: {
    name: 'Signed In Applicant',
    email: 'applicant@example.com',
    why_this_event: 'I want to build with the Boston AI community.',
    project_url: 'example.com/applicant-project',
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
  hasMore = false,
  rowsByStatus = defaultRowsByStatus,
}: {
  includeBannedUsers: boolean;
  rows: OrganizerRegistrationReviewRow[];
  statusFilter: RegistrationStatus;
  viewerRole: OrganizerReviewRole;
  hasMore?: boolean;
  rowsByStatus?: Record<RegistrationStatus, OrganizerRegistrationReviewRow[]>;
}): OrganizerRegistrationReviewState {
  return {
    eventId,
    statusFilter,
    includeBannedUsers,
    order: 'oldest',
    viewerRole,
    capacity: 40,
    counts: Object.fromEntries(
      Object.entries(rowsByStatus).map(([status, statusRows]) => [
        status,
        statusRows.length,
      ])
    ),
    rows,
    hasMore,
  };
}

function mockRegistrationReviewFetch({
  rowsByStatus = defaultRowsByStatus,
  viewerRole = 'MC',
  includeBlockedForSiteAdmin = false,
  pagesBySkip,
  failDecisions = false,
}: {
  rowsByStatus?: Record<RegistrationStatus, OrganizerRegistrationReviewRow[]>;
  viewerRole?: OrganizerReviewRole;
  includeBlockedForSiteAdmin?: boolean;
  pagesBySkip?: Record<string, OrganizerRegistrationReviewRow[]>;
  failDecisions?: boolean;
} = {}) {
  global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = parseRequestUrl(input);

    if (url.pathname === `/api/events/${eventId}/workspace`) {
      return jsonResponse(workspaceSummary);
    }

    if (
      url.pathname === `/api/events/${eventId}/registrations/decisions` &&
      init?.method === 'POST'
    ) {
      if (failDecisions) return jsonResponse('Internal Error', 500);
      const body = JSON.parse(String(init.body));
      return jsonResponse({
        status: body.status,
        updatedIds: body.registrationIds,
        failedIds: [],
      });
    }

    const notesMatch = url.pathname.match(/\/registrations\/([^/]+)\/notes$/);
    if (notesMatch && init?.method === 'PATCH') {
      return jsonResponse({ id: notesMatch[1] });
    }

    const decisionMatch = url.pathname.match(
      new RegExp(`^/api/events/${eventId}/registrations/([^/]+)$`)
    );
    if (decisionMatch && init?.method === 'PATCH') {
      if (failDecisions) return jsonResponse('Internal Error', 500);
      const body = JSON.parse(String(init.body));
      return jsonResponse({ id: decisionMatch[1], status: body.status });
    }

    if (url.pathname === `/api/events/${eventId}/registrations`) {
      const includeBannedUsers =
        url.searchParams.get('includeBannedUsers') === 'true';
      const statusFilter = (url.searchParams.get('status') ??
        'PENDING') as RegistrationStatus;
      const skip = url.searchParams.get('skip') ?? '0';
      const statusRows =
        pagesBySkip?.[skip] ?? rowsByStatus[statusFilter] ?? [];
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
          rowsByStatus,
          hasMore: Boolean(
            pagesBySkip && pagesBySkip[String(Number(skip) + rows.length)]
          ),
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

  render(<OrganizerEventRegistrationsPage />);
}

function renderWorkspaceRegistrations() {
  const OrganizerEventLayout = loadPage(
    '/organizer/events/[eventId] layout',
    '../../src/app/organizer/events/[eventId]/layout'
  ) as WorkspaceLayoutComponent;
  const OrganizerEventRegistrationsPage = loadPage(
    '/organizer/events/[eventId]/registrations',
    '../../src/app/organizer/events/[eventId]/registrations/page'
  );

  render(
    <OrganizerEventLayout>
      <OrganizerEventRegistrationsPage />
    </OrganizerEventLayout>
  );
}

function fetchUrls() {
  return (global.fetch as jest.Mock).mock.calls.map(([input]) =>
    requestUrl(input)
  );
}

function fetchCall(pathPattern: RegExp) {
  const call = (global.fetch as jest.Mock).mock.calls.find(([input]) =>
    pathPattern.test(parseRequestUrl(input).pathname)
  );

  if (!call) {
    throw new Error(`Expected fetch matching ${pathPattern}`);
  }

  return call;
}

function fetchBody(pathPattern: RegExp) {
  return JSON.parse(String(fetchCall(pathPattern)[1]?.body ?? '{}'));
}

async function findDetail(name: RegExp | string = /signed in applicant/i) {
  return screen.findByRole('article', {
    name: typeof name === 'string' ? `RSVP from ${name}` : name,
  });
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

  it('loads the queue alongside the workspace instead of fetching the workspace twice', async () => {
    renderWorkspaceRegistrations();

    const detail = await findDetail();
    expect(
      within(detail).getByRole('link', { name: 'Signed In Applicant' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('navigation', { name: /event workspace/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /rsvps/i })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(
      screen.getByRole('heading', { level: 1, name: 'AI Build Night' })
    ).toBeInTheDocument();

    const urls = fetchUrls();
    expect(
      urls.filter(url => url === `/api/events/${eventId}/workspace`)
    ).toHaveLength(1);
    expect(
      urls.filter(url =>
        url.startsWith(`/api/events/${eventId}/registrations?`)
      )
    ).toHaveLength(1);
    // The shell starts the RSVP request before the workspace request.
    expect(urls[0]).toMatch(/\/registrations\?status=PENDING&order=oldest$/);
  });

  it('shows the capacity summary from the queue response', async () => {
    renderRegistrationsPage();

    expect(await screen.findByText('1 / 40 approved')).toBeInTheDocument();
    expect(
      screen.getByRole('progressbar', { name: /1 of 40 spots filled/i })
    ).toBeInTheDocument();
    expect(screen.getByText(/1 waitlisted · 1 pending/i)).toBeInTheDocument();
  });

  it('keeps co-MCs note-only when registration review is opened through the workspace', async () => {
    mockRegistrationReviewFetch({
      viewerRole: 'CO_MC',
      rowsByStatus: {
        ...defaultRowsByStatus,
        PENDING: [{ ...pendingRow, capabilities: noteOnlyCapabilities }],
      },
    });

    renderWorkspaceRegistrations();

    await findDetail();
    expect(screen.getByLabelText(/internal review notes/i)).toBeEnabled();
    for (const name of [/^approve$/i, /^waitlist$/i, /^decline$/i]) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }
    expect(
      screen.queryByRole('checkbox', { name: /select/i })
    ).not.toBeInTheDocument();
  });

  it('links applicants to their profile and shows their history counts', async () => {
    renderRegistrationsPage();

    const detail = await findDetail();
    expect(
      within(detail).getByRole('link', { name: 'Signed In Applicant' })
    ).toHaveAttribute('href', '/hacker/hacker-applicant');
    expect(
      within(detail).getByText('Applied to 4 other events')
    ).toBeInTheDocument();
    expect(within(detail).getByText('Accepted to 3')).toBeInTheDocument();
    expect(within(detail).getByText('1 project')).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: /signed in applicant.*4 other events/i,
      })
    ).toBeInTheDocument();
  });

  it('renders status tabs and applicant answers for the active status', async () => {
    renderRegistrationsPage();

    const detail = await findDetail();
    for (const status of [
      'Pending',
      'Approved',
      'Waitlisted',
      'Declined',
      'Cancelled',
    ]) {
      expect(
        screen.getByRole('tab', { name: new RegExp(`${status} 1`, 'i') })
      ).toBeInTheDocument();
    }

    expect(
      within(detail).getByText(/applicant@example.com/i)
    ).toBeInTheDocument();
    expect(
      within(detail).getByText(/why do you want to join this event/i)
    ).toBeInTheDocument();
    expect(
      within(detail).getByText(/i want to build with the boston ai community/i)
    ).toBeInTheDocument();
    const projectLink = within(detail).getByRole('link', {
      name: 'example.com/applicant-project',
    });
    expect(projectLink).toHaveAttribute(
      'href',
      'https://example.com/applicant-project'
    );
    expect(projectLink).toHaveAttribute('target', '_blank');
    expect(projectLink).toHaveAttribute('rel', 'noopener noreferrer');
    expect(
      within(detail).getByText(/strong previous sundai contributor/i)
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /approved/i }));

    const approvedDetail = await findDetail('Approved Applicant');
    expect(screen.queryByText(/signed in applicant/i)).not.toBeInTheDocument();
    expect(
      within(approvedDetail).queryByRole('button', { name: /^approve$/i })
    ).not.toBeInTheDocument();
    expect(
      within(approvedDetail).getByRole('button', { name: /^waitlist$/i })
    ).toBeEnabled();
    expect(fetchUrls()).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/\/registrations\?status=APPROVED/),
      ])
    );

    fireEvent.click(screen.getByRole('tab', { name: /pending/i }));
    // A tab that was already loaded shows its rows right away.
    expect(
      screen.getByRole('article', { name: /signed in applicant/i })
    ).toBeInTheDocument();
  });

  it('saves internal review notes automatically without mixing them with public messages', async () => {
    renderRegistrationsPage();

    const notes = await screen.findByLabelText(/internal review notes/i);
    expect(notes).toHaveValue('Ask about available GPUs before approving.');

    fireEvent.change(notes, {
      target: { value: 'Confirmed GPU access and mentor match.' },
    });
    expect(screen.getByText(/unsaved changes/i)).toBeInTheDocument();
    fireEvent.blur(notes);

    expect(await screen.findByText(/notes saved/i)).toBeInTheDocument();
    expect(fetchCall(/\/registration-pending\/notes$/)[1]).toEqual(
      expect.objectContaining({ method: 'PATCH' })
    );
    const body = fetchBody(/\/registration-pending\/notes$/);
    expect(body).toEqual({
      internalReviewNotes: 'Confirmed GPU access and mentor match.',
    });
    expect(
      (global.fetch as jest.Mock).mock.calls.filter(([input]) =>
        requestUrl(input).endsWith('/notes')
      )
    ).toHaveLength(1);
  });

  it('approves the selected applicant, moves the counts, and selects the next one', async () => {
    const secondPending: OrganizerRegistrationReviewRow = {
      ...pendingRow,
      id: 'registration-pending-second',
      hackerId: 'hacker-second',
      applicant: {
        ...pendingRow.applicant,
        id: 'hacker-second',
        name: 'Second Applicant',
      },
    };
    mockRegistrationReviewFetch({
      rowsByStatus: {
        ...defaultRowsByStatus,
        PENDING: [pendingRow, secondPending],
      },
    });
    renderRegistrationsPage();

    const detail = await findDetail();
    fireEvent.click(within(detail).getByRole('button', { name: /^approve$/i }));

    await findDetail('Second Applicant');
    expect(fetchCall(/\/registrations\/registration-pending$/)[1]).toEqual(
      expect.objectContaining({ method: 'PATCH' })
    );
    expect(fetchBody(/\/registrations\/registration-pending$/)).toEqual({
      status: 'APPROVED',
    });
    expect(screen.getByRole('tab', { name: /pending 1/i })).toBeInTheDocument();
    expect(
      screen.getByRole('tab', { name: /approved 2/i })
    ).toBeInTheDocument();
    expect(screen.getByText('2 / 40 approved')).toBeInTheDocument();
  });

  it('shows an empty queue after the last pending applicant is decided', async () => {
    renderRegistrationsPage();

    const detail = await findDetail();
    fireEvent.click(within(detail).getByRole('button', { name: /^approve$/i }));

    expect(
      await screen.findByText(/no rsvps waiting for review/i)
    ).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /pending 0/i })).toBeInTheDocument();
  });

  it('keeps the applicant and shows an error when a decision fails', async () => {
    mockRegistrationReviewFetch({ failDecisions: true });
    renderRegistrationsPage();

    const detail = await findDetail();
    fireEvent.click(within(detail).getByRole('button', { name: /^approve$/i }));

    expect(
      await screen.findByText(/couldn't update signed in applicant/i)
    ).toBeInTheDocument();
    expect(await findDetail()).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /pending 1/i })).toBeInTheDocument();
  });

  it('asks for confirmation before declining', async () => {
    renderRegistrationsPage();

    const detail = await findDetail();
    fireEvent.click(within(detail).getByRole('button', { name: /^decline$/i }));

    expect(fetchUrls()).not.toEqual(
      expect.arrayContaining([
        expect.stringMatching(/\/registrations\/registration-pending$/),
      ])
    );
    fireEvent.click(
      within(detail).getByRole('button', { name: /confirm decline/i })
    );

    await waitFor(() => {
      expect(fetchBody(/\/registrations\/registration-pending$/)).toEqual({
        status: 'DECLINED',
      });
    });
  });

  it('marks applicants who have internal review notes', async () => {
    const withoutNotes: OrganizerRegistrationReviewRow = {
      ...pendingRow,
      id: 'registration-without-notes',
      hackerId: 'hacker-without-notes',
      applicant: {
        ...pendingRow.applicant,
        id: 'hacker-without-notes',
        name: 'Quiet Applicant',
      },
      internalReviewNotes: null,
    };
    mockRegistrationReviewFetch({
      rowsByStatus: {
        ...defaultRowsByStatus,
        PENDING: [pendingRow, withoutNotes],
      },
    });
    renderRegistrationsPage();

    const detail = await findDetail();
    expect(within(detail).getByText('Has notes')).toBeInTheDocument();
    const listItems = screen.getAllByRole('listitem');
    expect(within(listItems[0]).getByText('Notes')).toBeInTheDocument();
    expect(within(listItems[1]).queryByText('Notes')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /quiet applicant/i }));
    const quietDetail = await findDetail('Quiet Applicant');
    expect(
      within(quietDetail).queryByText('Has notes')
    ).not.toBeInTheDocument();
    const notes = within(quietDetail).getByLabelText(/internal review notes/i);
    fireEvent.change(notes, { target: { value: 'Met them at demo day.' } });
    fireEvent.blur(notes);

    await waitFor(() => {
      expect(
        within(screen.getAllByRole('listitem')[1]).getByText('Notes')
      ).toBeInTheDocument();
    });
  });

  it('approves several selected applicants with one bulk request', async () => {
    const secondPending: OrganizerRegistrationReviewRow = {
      ...pendingRow,
      id: 'registration-pending-second',
      hackerId: 'hacker-second',
      applicant: {
        ...pendingRow.applicant,
        id: 'hacker-second',
        name: 'Second Applicant',
      },
    };
    mockRegistrationReviewFetch({
      rowsByStatus: {
        ...defaultRowsByStatus,
        PENDING: [pendingRow, secondPending],
      },
    });
    renderRegistrationsPage();

    await findDetail();
    fireEvent.click(
      screen.getByRole('checkbox', { name: /select all loaded rsvps/i })
    );
    const bulkBar = screen.getByRole('region', { name: /bulk actions/i });
    expect(within(bulkBar).getByText('2 selected')).toBeInTheDocument();
    fireEvent.click(
      within(bulkBar).getByRole('button', { name: /approve selected/i })
    );

    expect(
      await screen.findByText(/no rsvps waiting for review/i)
    ).toBeInTheDocument();
    expect(fetchBody(/\/registrations\/decisions$/)).toEqual({
      registrationIds: ['registration-pending', 'registration-pending-second'],
      status: 'APPROVED',
    });
    expect(
      screen.getByRole('tab', { name: /approved 3/i })
    ).toBeInTheDocument();
  });

  it('confirms bulk declines before sending them', async () => {
    renderRegistrationsPage();

    await findDetail();
    fireEvent.click(
      screen.getByRole('checkbox', { name: /select signed in applicant/i })
    );
    const bulkBar = screen.getByRole('region', { name: /bulk actions/i });
    fireEvent.click(
      within(bulkBar).getByRole('button', { name: /decline selected/i })
    );
    expect(within(bulkBar).getByText(/decline 1 rsvp\?/i)).toBeInTheDocument();
    expect(fetchUrls().some(url => url.endsWith('/decisions'))).toBe(false);
  });

  it('searches the queue on the server after typing stops', async () => {
    renderRegistrationsPage();

    await findDetail();
    fireEvent.change(screen.getByLabelText(/search rsvps/i), {
      target: { value: 'gpu' },
    });

    await waitFor(() => {
      expect(fetchUrls()).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/\/registrations\?.*q=gpu/),
        ])
      );
    });
  });

  it('loads more rows on request', async () => {
    const nextRow: OrganizerRegistrationReviewRow = {
      ...pendingRow,
      id: 'registration-next-page',
      hackerId: 'hacker-next-page',
      applicant: {
        ...pendingRow.applicant,
        id: 'hacker-next-page',
        name: 'Next Page Applicant',
      },
    };
    mockRegistrationReviewFetch({
      pagesBySkip: { '0': [pendingRow], '1': [nextRow] },
    });
    renderRegistrationsPage();

    await findDetail();
    fireEvent.click(screen.getByRole('button', { name: /load more/i }));

    expect(
      await screen.findByRole('button', { name: /next page applicant/i })
    ).toBeInTheDocument();
    expect(fetchUrls()).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/\/registrations\?.*skip=1/),
      ])
    );
    expect(
      screen.queryByRole('button', { name: /load more/i })
    ).not.toBeInTheDocument();
  });

  it('keeps globally banned applicants and moderation signals hidden from non-site-admin queues', async () => {
    mockRegistrationReviewFetch({
      includeBlockedForSiteAdmin: true,
      viewerRole: 'CHAPTER_ADMIN',
    });

    renderRegistrationsPage();

    await findDetail();
    expect(screen.queryByText(/banned applicant/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/active global ban/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/unable to register/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/include banned/i)).not.toBeInTheDocument();
    expect(fetchUrls()).not.toEqual(
      expect.arrayContaining([
        expect.stringContaining('includeBannedUsers=true'),
      ])
    );
  });

  it('lets site admins include banned users and see blocked applicant ban context', async () => {
    mockRegistrationReviewFetch({
      includeBlockedForSiteAdmin: true,
      viewerRole: 'SITE_ADMIN',
    });

    renderRegistrationsPage();

    fireEvent.click(
      await screen.findByRole('checkbox', { name: /include banned users/i })
    );

    expect(
      await screen.findByRole('tab', { name: /blocked/i })
    ).toBeInTheDocument();
    fireEvent.click(
      await screen.findByRole('button', { name: /banned applicant/i })
    );
    const detail = await findDetail('Banned Applicant');
    expect(within(detail).getByText(/active ban/i)).toBeInTheDocument();
    expect(
      within(detail).getByText(/active global ban; visible to site admins/i)
    ).toBeInTheDocument();
    expect(within(detail).getByText(/unable to register/i)).toBeInTheDocument();
    expect(fetchUrls()).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/\/registrations\?.*includeBannedUsers=true/),
      ])
    );
  });
});
