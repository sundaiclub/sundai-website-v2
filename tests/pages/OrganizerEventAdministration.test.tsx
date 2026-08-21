import React from 'react';
import { resolvedParams } from '../utils/next';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

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
    refresh: jest.fn(),
  }),
}));

const eventId = 'event-ai-build-night';
const staffCandidates = [
  { id: 'hacker-mc', name: 'Morgan MC', email: 'morgan@example.com' },
  { id: 'hacker-casey', name: 'Casey Organizer', email: 'casey@example.com' },
];

const adminWorkspace = {
  event: {
    id: eventId,
    title: 'AI Build Night',
    status: 'PUBLISHED',
    chapter: { id: 'chapter-boston', name: 'Sundai Boston', slug: 'boston' },
    startTime: '2026-07-18T14:00:00.000Z',
    endTime: '2026-07-18T22:00:00.000Z',
    capacity: 80,
    applicationMode: 'REQUIRES_APPROVAL',
    applicationsOpen: true,
    autoPromoteWaitlist: false,
    publicUrl: '/events/boston/ai-build-night',
    hasApprovedOnlyDetails: true,
  },
  effectiveRole: 'CHAPTER_ADMIN',
  capabilities: {
    administerEvent: true,
    editEventSettings: true,
    assignStaff: true,
    decideApplicants: true,
    manageOperations: true,
    sendCommunications: true,
    manageMaterials: true,
    managePitch: true,
    editNotes: true,
    viewNoteHistory: true,
  },
  staff: [
    { id: 'staff-mc', hackerId: 'hacker-mc', name: 'Morgan MC', role: 'MC' },
  ],
  counts: {
    registrations: {
      pending: 1,
      approved: 2,
      waitlisted: 0,
      declined: 0,
      cancelled: 0,
    },
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
  unavailable: ['checkIn', 'attendance', 'noShows'],
};

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

function mockAdministrationFetch(workspace = adminWorkspace) {
  global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(requestUrl(input), 'http://localhost');
    if (url.pathname === `/api/events/${eventId}/workspace`)
      return jsonResponse(workspace);
    if (url.pathname === '/api/hackers') return jsonResponse(staffCandidates);
    if (url.pathname === `/api/events/${eventId}/staff` && !init?.method) {
      return jsonResponse(workspace.staff);
    }
    if (url.pathname === `/api/events/${eventId}/staff/audits`) {
      return jsonResponse({
        items: [
          {
            id: 'audit-assigned',
            action: 'ASSIGNED',
            staffHacker: { id: 'hacker-mc', name: 'Morgan MC' },
            actor: { id: 'hacker-admin', name: 'Alex Admin' },
            toRole: 'MC',
            createdAt: '2026-07-10T12:00:00.000Z',
          },
        ],
      });
    }
    if (
      url.pathname === `/api/events/${eventId}/staff` &&
      init?.method === 'POST'
    ) {
      return jsonResponse(
        {
          id: 'staff-new',
          hackerId: 'hacker-casey',
          name: 'Casey Organizer',
          ...JSON.parse(String(init.body)),
        },
        201
      );
    }
    if (
      url.pathname === `/api/events/${eventId}/staff/staff-mc` &&
      init?.method === 'DELETE'
    ) {
      return jsonResponse(null, 204);
    }
    return jsonResponse({ error: `Unexpected request: ${url.pathname}` }, 500);
  }) as jest.Mock;
}

function loadLayout(): React.ComponentType<{
  children: React.ReactNode;
  params: Promise<{ eventId: string }>;
}> {
  return require('../../src/app/organizer/events/[eventId]/layout').default;
}

function loadOverview(): React.ComponentType<{
  params: Promise<{ eventId: string }>;
}> {
  return require('../../src/app/organizer/events/[eventId]/page').default;
}

async function renderAdministration() {
  const Layout = loadLayout();
  const Overview = loadOverview();
  return render(
    await (
      Layout as unknown as (props: {
        children: React.ReactNode;
        params: Promise<{ eventId: string }>;
      }) => Promise<React.ReactElement>
    )({
      params: resolvedParams({ eventId }),
      children: <Overview params={resolvedParams({ eventId })} />,
    })
  );
}

describe('/organizer/events/[eventId] administration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseTheme.mockReturnValue({ isDarkMode: false });
    mockUseUserContext.mockReturnValue({
      isAdmin: false,
      loading: false,
      userInfo: { id: 'hacker-admin', role: 'HACKER' },
    });
    mockAdministrationFetch();
  });

  afterEach(cleanup);

  it('lets MCs edit settings while keeping lifecycle and staff controls admin-only', async () => {
    await renderAdministration();
    expect(
      await screen.findByRole('link', { name: /edit event details/i })
    ).toHaveAttribute('href', `/organizer/events/${eventId}/settings`);
    expect(
      screen.getByRole('button', { name: /add|assign staff/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /unpublish/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /cancel event/i })
    ).toBeInTheDocument();

    cleanup();
    mockAdministrationFetch({
      ...adminWorkspace,
      effectiveRole: 'MC',
      capabilities: {
        ...adminWorkspace.capabilities,
        administerEvent: false,
        editEventSettings: true,
        assignStaff: false,
        viewNoteHistory: false,
      },
    });
    await renderAdministration();
    await screen.findByText('AI Build Night');
    expect(
      screen.queryByRole('button', { name: /add|assign staff/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /publish|unpublish|cancel event/i })
    ).not.toBeInTheDocument();
    expect(
      await screen.findByRole('link', { name: /edit event details/i })
    ).toHaveAttribute('href', `/organizer/events/${eventId}/settings`);

    cleanup();
    mockAdministrationFetch({
      ...adminWorkspace,
      effectiveRole: 'CO_MC',
      capabilities: {
        ...adminWorkspace.capabilities,
        administerEvent: false,
        editEventSettings: false,
        assignStaff: false,
        viewNoteHistory: false,
      },
    });
    await renderAdministration();
    await screen.findByText('AI Build Night');
    expect(
      screen.queryByRole('link', { name: /edit event details/i })
    ).not.toBeInTheDocument();
  });

  it('assigns an MC or co-MC through the event-scoped staff endpoint', async () => {
    await renderAdministration();
    fireEvent.click(
      await screen.findByRole('button', { name: /add|assign staff/i })
    );
    fireEvent.change(await screen.findByPlaceholderText(/search members/i), {
      target: { value: 'Casey' },
    });
    fireEvent.click(
      await screen.findByRole('button', { name: /casey organizer/i })
    );
    fireEvent.change(
      await screen.findByLabelText(/staff role for casey organizer/i),
      {
        target: { value: 'CO_MC' },
      }
    );

    expect(global.fetch).not.toHaveBeenCalledWith(
      `/api/events/${eventId}/staff`,
      expect.objectContaining({ method: 'POST' })
    );
    fireEvent.click(screen.getByRole('button', { name: /^save$/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        `/api/events/${eventId}/staff`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ hackerId: 'hacker-casey', role: 'CO_MC' }),
        })
      );
    });
  });

  it('confirms staff removal and refreshes the visible assignment list', async () => {
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(true);
    await renderAdministration();
    fireEvent.click(
      await screen.findByRole('button', { name: /remove morgan mc/i })
    );
    expect(confirm).toHaveBeenCalled();
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        `/api/events/${eventId}/staff/staff-mc`,
        expect.objectContaining({ method: 'DELETE' })
      );
    });
    expect(screen.queryByText('Morgan MC')).not.toBeInTheDocument();
    confirm.mockRestore();
  });

  it('shows immutable staff audit history with actor, action, role, and time', async () => {
    await renderAdministration();
    fireEvent.click(
      await screen.findByRole('button', { name: /staff audit|view history/i })
    );
    expect(await screen.findByText('Alex Admin')).toBeInTheDocument();
    expect(screen.getByText(/assigned/i)).toBeInTheDocument();
    expect(screen.getByText(/morgan mc/i)).toBeInTheDocument();
    expect(screen.getByText(/^MC$/)).toBeInTheDocument();
    expect(screen.getByText(/2026|jul/i)).toBeInTheDocument();
  });
});
