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
let pathname = '/organizer/events/event-ai-build-night/projects';

jest.mock('../../src/app/contexts/ThemeContext', () => ({
  useTheme: () => mockUseTheme(),
}));

jest.mock('next/navigation', () => ({
  usePathname: () => pathname,
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    refresh: jest.fn(),
  }),
}));

const eventId = 'event-ai-build-night';
const pitchProjectId = 'pitch-project-ai-copilot';

const workspace = {
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
  staff: [],
  counts: {
    registrations: {
      pending: 0,
      approved: 4,
      waitlisted: 0,
      declined: 0,
      cancelled: 0,
    },
    projects: { total: 1, submittedCards: 0 },
    pitch: { queued: 1, pitched: 0, highlighted: 0 },
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

const eventProjects = [
  {
    pitchProjectId,
    project: {
      id: 'project-ai-copilot',
      title: 'Accessible AI Copilot',
      launchLead: { id: 'hacker-ada', name: 'Ada Builder' },
      team: [
        { id: 'hacker-ada', name: 'Ada Builder' },
        { id: 'hacker-grace', name: 'Grace Hacker' },
      ],
      tags: ['Accessibility', 'AI'],
      links: {
        demo: 'https://demo.example.com/copilot',
        github: 'https://github.com/example/copilot',
        blog: 'https://example.com/copilot-writeup',
      },
    },
    cardStatus: 'NEEDS_INFO',
    queue: { status: 'QUEUED', position: 2 },
    pitched: false,
    isTopProject: false,
    isHighlighted: false,
    pitchResults: null,
  },
];

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

function mockFetches() {
  global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url === `/api/events/${eventId}/workspace`)
      return jsonResponse(workspace);
    if (
      url === `/api/events/${eventId}/projects/${pitchProjectId}` &&
      init?.method === 'PATCH'
    ) {
      return jsonResponse({
        ...eventProjects[0],
        cardStatus: JSON.parse(String(init.body)).cardStatus,
      });
    }
    if (url === `/api/events/${eventId}/projects`)
      return jsonResponse({ items: eventProjects });
    return jsonResponse({}, 404);
  }) as jest.Mock;
}

function loadComponent(
  path: string
): React.ComponentType<{ params: Promise<{ eventId: string }> }> {
  try {
    return require(path).default;
  } catch (error) {
    throw new Error(
      `Expected organizer workspace page ${path}: ${String(error)}`
    );
  }
}

async function renderSection(section: 'projects' | 'pitch') {
  const Layout = loadComponent(
    '../../src/app/organizer/events/[eventId]/layout'
  ) as React.ComponentType<{
    children: React.ReactNode;
    params: Promise<{ eventId: string }>;
  }>;
  const Page = loadComponent(
    `../../src/app/organizer/events/[eventId]/${section}/page`
  );
  return render(
    await (
      Layout as unknown as (props: {
        children: React.ReactNode;
        params: Promise<{ eventId: string }>;
      }) => Promise<React.ReactElement>
    )({
      params: resolvedParams({ eventId }),
      children: <Page params={resolvedParams({ eventId })} />,
    })
  );
}

describe('organizer event Projects and Pitch workspace sections', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    pathname = `/organizer/events/${eventId}/projects`;
    mockUseTheme.mockReturnValue({ isDarkMode: false });
    mockFetches();
  });

  afterEach(cleanup);

  it('shows global project identity, team, tags, and project links', async () => {
    await renderSection('projects');

    expect(
      await screen.findByText('Accessible AI Copilot')
    ).toBeInTheDocument();
    expect(screen.getByText(/launch lead.*ada builder/i)).toBeInTheDocument();
    expect(screen.getByText('Grace Hacker')).toBeInTheDocument();
    expect(screen.getByText('Accessibility')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /demo/i })).toHaveAttribute(
      'href',
      'https://demo.example.com/copilot'
    );
    expect(screen.getByRole('link', { name: /github/i })).toHaveAttribute(
      'href',
      'https://github.com/example/copilot'
    );
    expect(
      screen.getByRole('link', { name: /blog|write.?up/i })
    ).toHaveAttribute('href', 'https://example.com/copilot-writeup');
  });

  it('shows and updates the event-specific project card state without implying a pitch gate', async () => {
    await renderSection('projects');

    const cardStatus = await screen.findByRole('combobox', {
      name: /card status/i,
    });
    expect(cardStatus).toHaveValue('NEEDS_INFO');
    fireEvent.change(cardStatus, { target: { value: 'SUBMITTED' } });

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        `/api/events/${eventId}/projects/${pitchProjectId}`,
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ cardStatus: 'SUBMITTED' }),
        })
      );
    });
    expect(await screen.findByText(/card status updated/i)).toBeInTheDocument();
    expect(
      screen.getByText(/does not block.*pitch|pitching is not blocked/i)
    ).toBeInTheDocument();
  });

  it('shows event-specific queue position and pitch outcome state', async () => {
    await renderSection('projects');

    await screen.findByText('Accessible AI Copilot');
    expect(screen.getByText(/queued/i)).toBeInTheDocument();
    expect(screen.getByText(/position 2|#2/i)).toBeInTheDocument();
    expect(screen.getByText(/not yet pitched/i)).toBeInTheDocument();
    expect(screen.getByText(/not highlighted/i)).toBeInTheDocument();
  });

  it('summarizes pitch state and links to the existing focused controller', async () => {
    pathname = `/organizer/events/${eventId}/pitch`;
    await renderSection('pitch');

    expect(await screen.findByText(/pitch summary/i)).toBeInTheDocument();
    expect(screen.getByText(/1 queued/i)).toBeInTheDocument();
    expect(screen.getByText(/0 pitched/i)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /open pitch controller/i })
    ).toHaveAttribute('href', `/pitch/${eventId}`);
    expect(
      screen.queryByRole('button', { name: /start timer|advance pitch/i })
    ).not.toBeInTheDocument();
  });
});
