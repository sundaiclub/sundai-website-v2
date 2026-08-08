import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';

const mockUseTheme = jest.fn();
const mockUseUserContext = jest.fn();

jest.mock('../../src/app/contexts/ThemeContext', () => ({
  useTheme: () => mockUseTheme(),
}));

jest.mock('../../src/app/contexts/UserContext', () => ({
  useUserContext: () => mockUseUserContext(),
}));

jest.mock('next/navigation', () => ({
  usePathname: () => '/organizer/events/event-ai-build-night',
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    refresh: jest.fn(),
  }),
}));

const eventId = 'event-ai-build-night';

const workspace = {
  event: {
    id: eventId,
    title: 'AI Build Night',
    status: 'PUBLISHED',
    timezone: 'America/New_York',
    chapter: {
      id: 'chapter-boston',
      name: 'Sundai Boston',
      slug: 'boston',
      timezone: 'America/New_York',
    },
    startTime: '2026-07-18T14:00:00.000Z',
    endTime: '2026-07-18T22:00:00.000Z',
    capacity: 80,
    applicationMode: 'REQUIRES_APPROVAL',
    applicationsOpen: true,
    autoPromoteWaitlist: false,
    publicUrl: '/events/boston/ai-build-night',
    hasApprovedOnlyDetails: true,
  },
  effectiveRole: 'MC',
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
  staff: [
    {
      id: 'event-staff-mc',
      hackerId: 'hacker-mc',
      name: 'Morgan MC',
      role: 'MC',
    },
    {
      id: 'event-staff-co-mc',
      hackerId: 'hacker-co-mc',
      name: 'Casey Co-MC',
      role: 'CO_MC',
    },
  ],
  counts: {
    registrations: {
      pending: 10,
      approved: 42,
      waitlisted: 7,
      declined: 3,
      cancelled: 2,
    },
    projects: { total: 12, submittedCards: 9 },
    pitch: { queued: 8, pitched: 4, highlighted: 2 },
    materials: 6,
    communications: 3,
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
  unavailable: ['checkIn', 'attendance', 'noShows'],
};

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

function mockWorkspaceFetch(data: unknown = workspace, status = 200) {
  global.fetch = jest.fn(() => jsonResponse(data, status)) as jest.Mock;
}

function loadLayout(): React.ComponentType<{
  children: React.ReactNode;
  params: { eventId: string };
}> {
  return require('../../src/app/organizer/events/[eventId]/layout').default;
}

function loadOverview(): React.ComponentType<{
  params: { eventId: string };
}> {
  return require('../../src/app/organizer/events/[eventId]/page').default;
}

function renderWorkspace(
  children: React.ReactNode = <div>Overview content</div>
) {
  const Layout = loadLayout();
  return render(<Layout params={{ eventId }}>{children}</Layout>);
}

describe('/organizer/events/[eventId] workspace', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseTheme.mockReturnValue({ isDarkMode: false });
    mockUseUserContext.mockReturnValue({
      loading: false,
      isAdmin: false,
      userInfo: {
        id: 'hacker-mc',
        name: 'Morgan MC',
        email: 'mc@example.com',
        role: 'HACKER',
      },
    });
    mockWorkspaceFetch();
  });

  afterEach(cleanup);

  it('renders the event-scoped shell identity and effective organizer role', async () => {
    renderWorkspace();

    expect(await screen.findByText('AI Build Night')).toBeInTheDocument();
    expect(screen.getByText('Sundai Boston')).toBeInTheDocument();
    expect(screen.getByText(/published/i)).toBeInTheDocument();
    expect(screen.getByText(/MC/)).toBeInTheDocument();
    expect(screen.getByText(/10:00 AM.*6:00 PM/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /view event/i })).toHaveAttribute(
      'href',
      '/events/boston/ai-build-night'
    );
  });

  it('provides event-scoped navigation for every completed workspace section', async () => {
    renderWorkspace();
    await screen.findByText('AI Build Night');

    const expectedLinks: Array<[RegExp, string]> = [
      [/overview/i, `/organizer/events/${eventId}`],
      [/rsvps/i, `/organizer/events/${eventId}/registrations`],
      [/communications/i, `/organizer/events/${eventId}/communications`],
      [/materials/i, `/organizer/events/${eventId}/materials`],
      [/projects/i, `/organizer/events/${eventId}/projects`],
      [/pitch/i, `/organizer/events/${eventId}/pitch`],
      [/notes/i, `/organizer/events/${eventId}/notes`],
      [/reporting preview/i, `/organizer/events/${eventId}/reporting`],
    ];

    for (const [name, href] of expectedLinks) {
      expect(screen.getByRole('link', { name })).toHaveAttribute('href', href);
    }
  });

  it('hides RSVP navigation from co-MCs while retaining other workspace tabs', async () => {
    mockWorkspaceFetch({
      ...workspace,
      effectiveRole: 'CO_MC',
      availableSections: workspace.availableSections.filter(
        section => section !== 'registrations'
      ),
    });

    renderWorkspace();
    await screen.findByText('AI Build Night');

    expect(
      screen.queryByRole('link', { name: /rsvps/i })
    ).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /overview/i })).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /communications/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /materials/i })
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /projects/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /^pitch$/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /notes/i })).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /reporting preview/i })
    ).toBeInTheDocument();
  });

  it('renders overview settings, staff, and safe operational counts', async () => {
    const Overview = loadOverview();
    renderWorkspace(<Overview params={{ eventId }} />);

    expect(await screen.findByText(/capacity/i)).toBeInTheDocument();
    expect(screen.getByText('80')).toBeInTheDocument();
    expect(screen.getByText(/requires approval/i)).toBeInTheDocument();
    expect(screen.getByText(/applications open/i)).toBeInTheDocument();
    expect(screen.getByText(/auto-promote.*off/i)).toBeInTheDocument();
    expect(screen.getByText('Morgan MC')).toBeInTheDocument();
    expect(screen.getByText('Casey Co-MC')).toBeInTheDocument();
    expect(screen.getByText(/42 approved/i)).toBeInTheDocument();
    expect(screen.getByText(/9 submitted cards/i)).toBeInTheDocument();
    expect(screen.getByText(/8 queued/i)).toBeInTheDocument();
    expect(screen.getByText(/6 materials/i)).toBeInTheDocument();
    expect(screen.getByText(/3 communications/i)).toBeInTheDocument();
  });

  it('shows permission lost without retaining event metadata after access is denied', async () => {
    mockWorkspaceFetch('Forbidden', 403);
    renderWorkspace();

    expect(
      await screen.findByText(/permission.*lost|no longer have access/i)
    ).toBeInTheDocument();
    expect(screen.queryByText('AI Build Night')).not.toBeInTheDocument();
    expect(screen.queryByText('Sundai Boston')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /public event/i })
    ).not.toBeInTheDocument();
  });

  it('does not expose check-in, attendance, or no-show controls', async () => {
    const Overview = loadOverview();
    renderWorkspace(<Overview params={{ eventId }} />);
    await screen.findByText('AI Build Night');

    expect(
      screen.queryByRole('link', { name: /check[ -]?in/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /check[ -]?in/i })
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/attendance/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/no[ -]?shows?/i)).not.toBeInTheDocument();
  });
});
