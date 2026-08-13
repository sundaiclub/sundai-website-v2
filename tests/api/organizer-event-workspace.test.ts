import { NextResponse } from 'next/server';
import { createJsonRequest, createRouteContext } from '../utils/api-auth';

const mockRequireEventWorkspaceAccess = jest.fn();
const mockLoadEventWorkspace = jest.fn();

jest.mock('../../src/lib/eventManagementApi', () => ({
  requireEventWorkspaceAccess: (...args: unknown[]) =>
    mockRequireEventWorkspaceAccess(...args),
}));

jest.mock(
  '../../src/lib/eventWorkspace',
  () => ({
    loadEventWorkspace: (...args: unknown[]) => mockLoadEventWorkspace(...args),
    getEventWorkspace: (...args: unknown[]) => mockLoadEventWorkspace(...args),
  }),
  { virtual: true }
);

type WorkspaceRoute = {
  GET: (
    request: Request,
    context: { params: { eventId: string } }
  ) => Promise<Response>;
};

const eventId = 'event-boston-ai-build-night';

const loadWorkspaceRoute = (): WorkspaceRoute => {
  try {
    const route = require('../../src/app/api/events/[eventId]/workspace/route');
    if (typeof route.GET !== 'function') {
      throw new Error('route must export a GET handler');
    }
    return route;
  } catch (error) {
    throw new Error(
      `Expected GET /api/events/[eventId]/workspace route for T014. ${String(
        error
      )}`
    );
  }
};

const event = {
  id: eventId,
  title: 'Boston AI Build Night',
  status: 'PUBLISHED',
  chapter: { id: 'chapter-boston', name: 'Boston', slug: 'boston' },
  startTime: '2026-07-18T14:00:00.000Z',
  endTime: '2026-07-18T22:00:00.000Z',
  capacity: 80,
  applicationMode: 'REQUIRES_APPROVAL',
  applicationsOpen: true,
  autoPromoteWaitlist: false,
  publicUrl: '/events/boston/boston-ai-build-night',
  hasApprovedOnlyDetails: true,
};

const operationalCapabilities = {
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
};

const counts = {
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
};

const workspace = (overrides: Record<string, unknown> = {}) => ({
  event,
  capabilities: operationalCapabilities,
  counts,
  staff: [],
  unavailable: ['checkIn', 'attendance', 'noShows'],
  ...overrides,
});

const allowWorkspace = (role = 'MC') => {
  mockRequireEventWorkspaceAccess.mockResolvedValue({
    hacker: { id: `hacker-${role.toLowerCase()}`, role: null },
    event: { id: eventId, chapterId: event.chapter.id },
    response: null,
  });
};

const getWorkspace = async () => {
  const route = loadWorkspaceRoute();
  return route.GET(
    createJsonRequest(`/api/events/${eventId}/workspace`) as any,
    createRouteContext({ eventId }) as any
  );
};

describe('GET /api/events/[eventId]/workspace', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    allowWorkspace();
    mockLoadEventWorkspace.mockResolvedValue(workspace());
  });

  it('returns the authorization response without loading or disclosing workspace data', async () => {
    mockRequireEventWorkspaceAccess.mockResolvedValue({
      hacker: { id: 'hacker-unrelated', role: null },
      event: null,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    });

    const response = await getWorkspace();
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({ error: 'Forbidden' });
    expect(JSON.stringify(body)).not.toContain(event.title);
    expect(mockLoadEventWorkspace).not.toHaveBeenCalled();
  });

  it('returns administrator capabilities for a site or in-scope chapter admin', async () => {
    allowWorkspace('SITE_ADMIN');
    mockLoadEventWorkspace.mockResolvedValue(
      workspace({
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
      })
    );

    const response = await getWorkspace();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.capabilities).toEqual({
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
    });
  });

  it('returns capability-specific MC and co-MC controls without administrative authority', async () => {
    for (const [role, decideApplicants] of [
      ['MC', true],
      ['CO_MC', false],
    ] as const) {
      jest.clearAllMocks();
      allowWorkspace(role);
      mockLoadEventWorkspace.mockResolvedValue(
        workspace({
          capabilities: {
            ...operationalCapabilities,
            editEventSettings: role === 'MC',
            decideApplicants,
          },
        })
      );

      const response = await getWorkspace();
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.capabilities).toMatchObject({
        administerEvent: false,
        editEventSettings: role === 'MC',
        assignStaff: false,
        decideApplicants,
        manageOperations: true,
        sendCommunications: true,
        manageMaterials: true,
        managePitch: true,
        editNotes: true,
        viewNoteHistory: false,
      });
    }
  });

  it('returns ban-safe overview aggregates without a hidden or blocked count', async () => {
    const response = await getWorkspace();
    const body = await response.json();
    const serialized = JSON.stringify(body);

    expect(response.status).toBe(200);
    expect(body.counts).toEqual(counts);
    expect(serialized).not.toMatch(/hidden|global.?ban|banReason/i);
    expect(body.counts.registrations).not.toHaveProperty('blocked');
  });

  it('represents valid empty overview collections with stable zero counts', async () => {
    const emptyCounts = {
      registrations: {
        pending: 0,
        approved: 0,
        waitlisted: 0,
        declined: 0,
        cancelled: 0,
      },
      projects: { total: 0, submittedCards: 0 },
      pitch: { queued: 0, pitched: 0, highlighted: 0 },
      materials: 0,
      communications: 0,
    };
    mockLoadEventWorkspace.mockResolvedValue(
      workspace({ counts: emptyCounts })
    );

    const response = await getWorkspace();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.counts).toEqual(emptyCounts);
    expect(body.staff).toEqual([]);
  });

  it('marks check-in, attendance, and no-show metrics unavailable instead of zero', async () => {
    const response = await getWorkspace();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.unavailable).toEqual(['checkIn', 'attendance', 'noShows']);
    expect(body.counts).not.toHaveProperty('checkIn');
    expect(body.counts).not.toHaveProperty('attendance');
    expect(body.counts).not.toHaveProperty('noShows');
  });
});
