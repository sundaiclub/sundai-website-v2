import { TextEncoder } from 'util';
import { NextResponse } from 'next/server';
import { createJsonRequest, createRouteContext } from '../utils/api-auth';
import { GET, POST } from '../../src/app/api/events/[eventId]/check-ins/route';
import { GET as GET_QR } from '../../src/app/api/qr/check-in/[token]/route';
import {
  checkInEventRegistration,
  listEventCheckIns,
} from '../../src/lib/eventCheckIn';

const mockRequireEventWorkspaceAccess = jest.fn();

jest.mock('../../src/lib/eventManagementApi', () => ({
  badRequest: (message: string) =>
    require('next/server').NextResponse.json({ message }, { status: 400 }),
  requireEventWorkspaceAccess: (...args: unknown[]) =>
    mockRequireEventWorkspaceAccess(...args),
}));

jest.mock('../../src/lib/eventCheckIn', () => ({
  ...jest.requireActual('../../src/lib/eventCheckIn'),
  checkInEventRegistration: jest.fn(),
  listEventCheckIns: jest.fn(),
}));

jest.mock('../../src/lib/prisma', () => ({ __esModule: true, default: {} }));

// jsdom omits TextEncoder, which the QR encoder needs.
Object.assign(global, { TextEncoder });

const eventId = 'event-1';
const organizer = { id: 'hacker-mc', role: null, name: 'Morgan MC' };
const mockCheckIn = checkInEventRegistration as jest.Mock;
const mockList = listEventCheckIns as jest.Mock;

const postCheckIn = (body: unknown) =>
  POST(
    createJsonRequest(`/api/events/${eventId}/check-ins`, {
      method: 'POST',
      body,
    }) as Request,
    createRouteContext({ eventId })
  );

beforeEach(() => {
  jest.resetAllMocks();
  mockRequireEventWorkspaceAccess.mockResolvedValue({
    hacker: organizer,
    event: { id: eventId, trackAttendance: true },
    response: null,
  });
});

describe('GET /api/events/[eventId]/check-ins', () => {
  it('requires workspace access', async () => {
    mockRequireEventWorkspaceAccess.mockResolvedValue({
      hacker: null,
      event: null,
      response: new NextResponse('Forbidden', { status: 403 }),
    });

    const response = await GET(
      createJsonRequest(`/api/events/${eventId}/check-ins`) as Request,
      createRouteContext({ eventId })
    );

    expect(response.status).toBe(403);
    expect(mockList).not.toHaveBeenCalled();
  });

  it('returns counts and searched approved attendees', async () => {
    mockList.mockResolvedValue({
      counts: { approved: 10, checkedIn: 4 },
      rows: [],
      hasMore: false,
    });

    const response = await GET(
      createJsonRequest(`/api/events/${eventId}/check-ins`, {
        searchParams: { search: 'ada' },
      }) as Request,
      createRouteContext({ eventId })
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      trackAttendance: true,
      counts: { approved: 10, checkedIn: 4 },
      rows: [],
      hasMore: false,
    });
    expect(mockList).toHaveBeenCalledWith({
      eventId,
      actor: organizer,
      search: 'ada',
    });
  });
});

describe('POST /api/events/[eventId]/check-ins', () => {
  it('requires workspace access', async () => {
    mockRequireEventWorkspaceAccess.mockResolvedValue({
      hacker: { id: 'hacker-attendee', role: null },
      event: null,
      response: new NextResponse('Forbidden', { status: 403 }),
    });

    const response = await postCheckIn({ registrationId: 'registration-1' });

    expect(response.status).toBe(403);
    expect(mockCheckIn).not.toHaveBeenCalled();
  });

  it('requires a registration id', async () => {
    const response = await postCheckIn({});

    expect(response.status).toBe(400);
    expect(mockCheckIn).not.toHaveBeenCalled();
  });

  it('checks the attendee in as the current organizer', async () => {
    const checkedInAt = new Date('2026-07-18T18:00:00.000Z');
    mockCheckIn.mockResolvedValue({
      ok: true,
      registration: {
        id: 'registration-1',
        checkedInAt,
        checkedInById: organizer.id,
      },
    });

    const response = await postCheckIn({ registrationId: 'registration-1' });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      registrationId: 'registration-1',
      checkedInAt: checkedInAt.toISOString(),
      checkedInBy: 'Morgan MC',
    });
    expect(mockCheckIn).toHaveBeenCalledWith({
      eventId,
      registrationId: 'registration-1',
      actorId: organizer.id,
    });
  });

  it.each([
    ['NOT_FOUND', 404, 'Registration not found.'],
    ['EVENT_ENDED', 409, 'This event has ended.'],
    ['NOT_APPROVED', 409, 'Only approved attendees can be checked in.'],
    ['ALREADY_CHECKED_IN', 409, 'This attendee is already checked in.'],
  ])('maps %s to a %i response', async (reason, status, message) => {
    mockCheckIn.mockResolvedValue({ ok: false, reason });

    const response = await postCheckIn({ registrationId: 'registration-1' });

    expect(response.status).toBe(status);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({ reason, message })
    );
  });
});

describe('GET /api/qr/check-in/[token]', () => {
  it('renders a cacheable PNG for a valid token', async () => {
    const response = await GET_QR(new Request('http://localhost/qr'), {
      params: { token: '7d4f3c2a-1b0e-4a9d-8c7b-6e5f4d3c2b1a' },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('image/png');
    expect(response.headers.get('cache-control')).toContain('immutable');
  });

  it('rejects malformed tokens', async () => {
    const response = await GET_QR(new Request('http://localhost/qr'), {
      params: { token: 'not-a-token' },
    });

    expect(response.status).toBe(404);
  });
});
