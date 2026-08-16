import React from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mockUseTheme = jest.fn();

jest.mock('../../src/app/contexts/ThemeContext', () => ({
  useTheme: () => mockUseTheme(),
}));

jest.mock('next/navigation', () => ({
  usePathname: () => '/organizer/events/event-accessible/materials',
}));

const eventId = 'event-accessible';
const workspace = {
  event: {
    id: eventId,
    title: 'Accessible Build Night',
    status: 'PUBLISHED',
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
    publicUrl: '/events/boston/accessible-build-night',
    hasApprovedOnlyDetails: true,
  },
  effectiveRole: 'MC' as const,
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
      pending: 0,
      approved: 0,
      waitlisted: 0,
      declined: 0,
      cancelled: 0,
    },
    projects: { total: 0, submittedCards: 0 },
    pitch: { queued: 0, pitched: 0, highlighted: 0 },
    materials: 1,
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
  ] as const,
  unavailable: ['checkIn', 'attendance', 'noShows'] as const,
};

const material = {
  id: 'material-private-brief',
  eventId,
  kind: 'FILE',
  visibility: 'ORGANIZERS_ONLY',
  title: 'Private sponsor brief',
  description: null,
  externalUrl: null,
  originalFilename: 'brief.pdf',
  mimeType: 'application/pdf',
  size: 1200,
  position: 1,
  isAvailable: false,
  availableFrom: null,
  availableUntil: null,
  createdById: 'hacker-mc',
  createdAt: '2026-07-10T12:00:00.000Z',
  updatedAt: '2026-07-10T12:00:00.000Z',
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

describe('organizer event workspace accessibility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseTheme.mockReturnValue({ isDarkMode: false });
  });

  afterEach(cleanup);

  it('supports keyboard navigation and exposes the current section semantically', async () => {
    const WorkspaceShell =
      require('../../src/app/organizer/events/[eventId]/WorkspaceShell').default;
    const user = userEvent.setup();
    render(
      <WorkspaceShell eventId={eventId} initialWorkspace={workspace}>
        <p>Materials content</p>
      </WorkspaceShell>
    );

    const navigation = screen.getByRole('navigation', {
      name: /event workspace/i,
    });
    const links = Array.from(navigation.querySelectorAll('a'));
    expect(links).toHaveLength(8);
    expect(screen.getByRole('link', { name: /materials/i })).toHaveAttribute(
      'aria-current',
      'page'
    );

    await user.tab();
    expect(screen.getByRole('link', { name: /back to event/i })).toHaveFocus();
    expect(
      screen.getByRole('link', { name: /back to event/i })
    ).toHaveAttribute('href', workspace.event.publicUrl);
    await user.tab();
    expect(screen.getByRole('link', { name: /view event/i })).toHaveFocus();
    for (const link of links) {
      await user.tab();
      expect(link).toHaveFocus();
    }
  });

  it('announces loading and permission failures through live status semantics', async () => {
    const {
      WorkspaceLoading,
      WorkspacePermissionLost,
    } = require('../../src/app/organizer/events/[eventId]/WorkspaceShell');
    const { rerender } = render(<WorkspaceLoading />);
    expect(screen.getByRole('status')).toHaveTextContent(
      /loading event workspace/i
    );

    rerender(<WorkspacePermissionLost />);
    expect(screen.getByRole('alert')).toHaveTextContent(
      /no longer have access/i
    );
  });

  it('exposes material visibility and availability with readable text, not color alone', async () => {
    global.fetch = jest.fn(() => jsonResponse([material])) as jest.Mock;
    const EventMaterialsPanel =
      require('../../src/app/organizer/events/[eventId]/materials/EventMaterialsPanel').default;
    render(<EventMaterialsPanel eventId={eventId} />);

    expect(
      await screen.findByText('Private sponsor brief')
    ).toBeInTheDocument();
    expect(screen.getByText('Organizers only')).toBeInTheDocument();
    expect(screen.getByText('Unavailable')).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: /mark private sponsor brief available/i,
      })
    ).toBeInTheDocument();
  });

  it('requires destructive confirmation and preserves focus when deletion is cancelled', async () => {
    global.fetch = jest.fn(() => jsonResponse([material])) as jest.Mock;
    jest.spyOn(window, 'confirm').mockReturnValue(false);
    const EventMaterialsPanel =
      require('../../src/app/organizer/events/[eventId]/materials/EventMaterialsPanel').default;
    render(<EventMaterialsPanel eventId={eventId} />);

    const remove = await screen.findByRole('button', {
      name: /delete private sponsor brief/i,
    });
    remove.focus();
    fireEvent.click(remove);

    expect(window.confirm).toHaveBeenCalledWith(
      expect.stringMatching(/cannot be undone/i)
    );
    expect(remove).toHaveFocus();
    expect(global.fetch).not.toHaveBeenCalledWith(
      expect.stringContaining(`/materials/${material.id}`),
      expect.objectContaining({ method: 'DELETE' })
    );
  });

  it('announces destructive staff removal and restores focus to a stable control', async () => {
    const staff = [
      {
        id: 'staff-mc',
        hackerId: 'hacker-mc',
        name: 'Morgan MC',
        role: 'MC',
      },
    ];
    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) =>
      init?.method === 'DELETE' ? jsonResponse(null, 204) : jsonResponse(staff)
    ) as jest.Mock;
    jest.spyOn(window, 'confirm').mockReturnValue(true);
    const EventStaffPanel =
      require('../../src/app/organizer/events/[eventId]/staff/EventStaffPanel').default;
    render(
      <EventStaffPanel eventId={eventId} canAssignStaff initialStaff={staff} />
    );

    const remove = await screen.findByRole('button', {
      name: /remove morgan mc/i,
    });
    fireEvent.click(remove);

    expect(window.confirm).toHaveBeenCalledWith(
      expect.stringMatching(/remove morgan mc/i)
    );
    expect(await screen.findByRole('status')).toHaveTextContent(
      /access is revoked immediately/i
    );
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /add staff/i })).toHaveFocus();
    });
  });
});
