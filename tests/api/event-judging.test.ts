import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { createJsonRequest, createRouteContext } from '../utils/api-auth';
import { GET as getJudgePanel } from '../../src/app/api/judging/[eventId]/route';
import { PUT as putReview } from '../../src/app/api/judging/[eventId]/reviews/[submissionId]/route';
import {
  GET as getJudgingConfig,
  PUT as putJudgingConfig,
} from '../../src/app/api/events/[eventId]/judging/route';
import { GET as getAssignments } from '../../src/app/api/events/[eventId]/judging/assignments/route';
import { POST as inviteJudge } from '../../src/app/api/events/[eventId]/judging/judges/route';
import { PUT as putProjectJudging } from '../../src/app/api/projects/[projectId]/judging/route';
import {
  hashJudgeToken,
  judgeMagicLink,
  resolveEventJudge,
  sendJudgeInvite,
} from '../../src/lib/judgingAccess';
import {
  JudgingError,
  loadJudgePanel,
  loadJudgingConfig,
  loadJudgingAssignments,
  saveJudgeReview,
  saveJudgingConfig,
  saveProjectJudgingSubmission,
  upsertEventJudge,
} from '../../src/lib/judgingData';
import { getEventPermissionContext } from '../../src/lib/eventManagementAuth';
import { JUDGE_TOKEN_HEADER } from '../../src/types/judging';

jest.mock('@clerk/nextjs/server', () => ({ auth: jest.fn() }));

const mockRequireEventJudgingManager = jest.fn();
const mockGetCurrentHacker = jest.fn();

jest.mock('../../src/lib/eventManagementApi', () => ({
  requireEventJudgingManager: (...args: unknown[]) =>
    mockRequireEventJudgingManager(...args),
  getCurrentHacker: () => mockGetCurrentHacker(),
  unauthorized: () =>
    new (require('next/server').NextResponse)('Unauthorized', { status: 401 }),
}));

jest.mock('../../src/lib/judgingAccess', () => ({
  ...jest.requireActual('../../src/lib/judgingAccess'),
  resolveEventJudge: jest.fn(),
  sendJudgeInvite: jest.fn(),
}));

jest.mock('../../src/lib/judgingData', () => ({
  ...jest.requireActual('../../src/lib/judgingData'),
  loadJudgePanel: jest.fn(),
  loadJudgingConfig: jest.fn(),
  loadJudgingAssignments: jest.fn(),
  saveJudgeReview: jest.fn(),
  saveJudgingConfig: jest.fn(),
  saveProjectJudgingSubmission: jest.fn(),
  upsertEventJudge: jest.fn(),
}));

jest.mock('../../src/lib/eventManagementAuth', () => ({
  ...jest.requireActual('../../src/lib/eventManagementAuth'),
  getEventPermissionContext: jest.fn(),
}));

jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    project: { findUnique: jest.fn() },
    judgingSubmission: { findMany: jest.fn().mockResolvedValue([]) },
    event: { findFirst: jest.fn() },
    hacker: { findUnique: jest.fn() },
    eventJudge: { findFirst: jest.fn(), update: jest.fn() },
  },
}));

const prisma = require('../../src/lib/prisma').default;
const actualResolveEventJudge = jest.requireActual(
  '../../src/lib/judgingAccess'
).resolveEventJudge as typeof resolveEventJudge;
const eventId = 'event-1';
const judge = { id: 'judge-1', email: 'judge@example.com', name: 'Jo' };
const organizer = { id: 'hacker-mc', role: null };

beforeEach(() => {
  jest.resetAllMocks();
  prisma.judgingSubmission.findMany.mockResolvedValue([]);
  (auth as jest.Mock).mockReturnValue({ userId: null });
  mockRequireEventJudgingManager.mockResolvedValue({
    hacker: organizer,
    event: { id: eventId },
    response: null,
  });
});

describe('resolveEventJudge', () => {
  it('hides judging from signed-out viewers without a link token', async () => {
    await expect(actualResolveEventJudge(eventId, null)).resolves.toBeNull();
    expect(prisma.eventJudge.findFirst).not.toHaveBeenCalled();
  });

  it('accepts a valid magic-link token without any account', async () => {
    prisma.eventJudge.findFirst.mockResolvedValue({ ...judge, hackerId: null });

    await expect(
      actualResolveEventJudge(eventId, 'secret')
    ).resolves.toMatchObject(judge);
    expect(prisma.eventJudge.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          eventId,
          tokenHash: hashJudgeToken('secret'),
          revokedAt: null,
        },
      })
    );
  });

  it('hides judging from signed-in accounts that were not invited', async () => {
    (auth as jest.Mock).mockReturnValue({ userId: 'clerk-other' });
    prisma.hacker.findUnique.mockResolvedValue({
      id: 'hacker-other',
      email: 'other@example.com',
    });
    prisma.eventJudge.findFirst.mockResolvedValue(null);

    await expect(actualResolveEventJudge(eventId, null)).resolves.toBeNull();
  });

  it('recognizes an invited account and links it to the invite', async () => {
    (auth as jest.Mock).mockReturnValue({ userId: 'clerk-judge' });
    prisma.hacker.findUnique.mockResolvedValue({
      id: 'hacker-judge',
      email: 'Judge@Example.com',
    });
    prisma.eventJudge.findFirst.mockResolvedValue({ ...judge, hackerId: null });

    await expect(actualResolveEventJudge(eventId, null)).resolves.toMatchObject(
      judge
    );
    expect(prisma.eventJudge.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { hackerId: 'hacker-judge' },
            { email: 'judge@example.com', hackerId: null },
          ],
        }),
      })
    );
    expect(prisma.eventJudge.update).toHaveBeenCalledWith({
      where: { id: 'judge-1' },
      data: { hackerId: 'hacker-judge' },
    });
  });
});

describe('judgeMagicLink', () => {
  it('opens the judging tab with the token on the inviting deployment', () => {
    expect(
      judgeMagicLink('tok/en', 'https://preview.vercel.app', {
        chapterSlug: 'boston',
        slug: 'demo-day',
      })
    ).toBe(
      'https://preview.vercel.app/events/boston/demo-day?tab=judging&judge=tok%2Fen'
    );
  });
});

describe('judge APIs', () => {
  it('rejects viewers who are not judges', async () => {
    (resolveEventJudge as jest.Mock).mockResolvedValue(null);
    const response = await getJudgePanel(
      new Request(`http://localhost/api/judging/${eventId}`),
      createRouteContext({ eventId })
    );
    expect(response.status).toBe(403);
    expect(loadJudgePanel).not.toHaveBeenCalled();
  });

  it('loads the panel for the resolved judge', async () => {
    (resolveEventJudge as jest.Mock).mockResolvedValue(judge);
    (loadJudgePanel as jest.Mock).mockResolvedValue({ judge, tracks: [] });
    const response = await getJudgePanel(
      new Request(`http://localhost/api/judging/${eventId}`, {
        headers: { [JUDGE_TOKEN_HEADER]: 'secret' },
      }),
      createRouteContext({ eventId })
    );
    expect(response.status).toBe(200);
    expect(resolveEventJudge).toHaveBeenCalledWith(eventId, 'secret');
    expect(loadJudgePanel).toHaveBeenCalledWith(eventId, 'judge-1');
  });

  it('saves scores as the resolved judge only', async () => {
    (resolveEventJudge as jest.Mock).mockResolvedValue(judge);
    (saveJudgeReview as jest.Mock).mockResolvedValue({ scores: { c: 7 } });
    const response = await putReview(
      createJsonRequest(`/api/judging/${eventId}/reviews/s-1`, {
        method: 'PUT',
        body: { scores: { c: 7 }, comment: 'Nice', judgeId: 'someone-else' },
      }) as Request,
      createRouteContext({ eventId, submissionId: 's-1' })
    );
    expect(response.status).toBe(200);
    expect(saveJudgeReview).toHaveBeenCalledWith({
      eventId,
      judgeId: 'judge-1',
      submissionId: 's-1',
      scores: { c: 7 },
      comment: 'Nice',
    });
  });

  it('surfaces judging errors with their status', async () => {
    (resolveEventJudge as jest.Mock).mockResolvedValue(judge);
    (saveJudgeReview as jest.Mock).mockRejectedValue(
      new JudgingError('Judging is closed.', 409)
    );
    const response = await putReview(
      createJsonRequest(`/api/judging/${eventId}/reviews/s-1`, {
        method: 'PUT',
        body: { scores: {} },
      }) as Request,
      createRouteContext({ eventId, submissionId: 's-1' })
    );
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      message: 'Judging is closed.',
    });
  });
});

describe('organizer judging APIs', () => {
  it('requires judging management access', async () => {
    mockRequireEventJudgingManager.mockResolvedValue({
      hacker: organizer,
      event: null,
      response: new NextResponse('Forbidden', { status: 403 }),
    });
    const response = await getJudgingConfig(
      new Request(`http://localhost/api/events/${eventId}/judging`),
      createRouteContext({ eventId })
    );
    expect(response.status).toBe(403);
    expect(loadJudgingConfig).not.toHaveBeenCalled();
  });

  it('protects assignment previews with organizer access', async () => {
    mockRequireEventJudgingManager.mockResolvedValue({
      response: new NextResponse('Forbidden', { status: 403 }),
    });
    const response = await getAssignments(
      new Request('http://localhost/api/events/event-1/judging/assignments'),
      createRouteContext({ eventId })
    );
    expect(response.status).toBe(403);
    expect(loadJudgingAssignments).not.toHaveBeenCalled();
  });

  it('returns the current draft to an organizer', async () => {
    (loadJudgingAssignments as jest.Mock).mockResolvedValue({
      published: false,
      judgesPerProject: 3,
      shortages: [],
    });
    const response = await getAssignments(
      new Request('http://localhost/api/events/event-1/judging/assignments'),
      createRouteContext({ eventId })
    );
    expect(response.status).toBe(200);
    expect(loadJudgingAssignments).toHaveBeenCalledWith(eventId);
    await expect(response.json()).resolves.toMatchObject({
      published: false,
      judgesPerProject: 3,
    });
  });

  it('saves the setup and returns the fresh config', async () => {
    (loadJudgingConfig as jest.Mock).mockResolvedValue({ tracks: [] });
    const body = { judgingEnabled: false, tracks: [], criteria: [] };
    const response = await putJudgingConfig(
      createJsonRequest(`/api/events/${eventId}/judging`, {
        method: 'PUT',
        body,
      }) as Request,
      createRouteContext({ eventId })
    );
    expect(response.status).toBe(200);
    expect(saveJudgingConfig).toHaveBeenCalledWith(eventId, body);
  });

  it('invites a judge by email and reports delivery', async () => {
    (upsertEventJudge as jest.Mock).mockResolvedValue('judge-new');
    (sendJudgeInvite as jest.Mock).mockResolvedValue({
      sent: true,
      message: null,
      devLink: null,
    });
    (loadJudgingConfig as jest.Mock).mockResolvedValue({ judges: [] });

    const response = await inviteJudge(
      createJsonRequest(`/api/events/${eventId}/judging/judges`, {
        method: 'POST',
        body: { email: 'Judge@Example.com', name: 'Jo', trackIds: ['t1'] },
      }) as Request,
      createRouteContext({ eventId })
    );

    expect(response.status).toBe(201);
    expect(upsertEventJudge).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId,
        actorId: 'hacker-mc',
        email: 'Judge@Example.com',
        trackIds: ['t1'],
      })
    );
    // The link points back at the deployment the organizer invited from.
    expect(sendJudgeInvite).toHaveBeenCalledWith(
      'judge-new',
      'http://localhost:3000'
    );
    await expect(response.json()).resolves.toMatchObject({
      delivery: { sent: true },
    });
  });
});

describe('PUT /api/projects/[projectId]/judging', () => {
  const putSubmission = () =>
    putProjectJudging(
      createJsonRequest('/api/projects/project-1/judging', {
        method: 'PUT',
        body: { eventId, trackId: 't1', answers: { q1: 'Yes' } },
      }) as Request,
      createRouteContext({ projectId: 'project-1' })
    );

  beforeEach(() => {
    mockGetCurrentHacker.mockResolvedValue({ id: 'hacker-1', role: 'HACKER' });
    prisma.project.findUnique.mockResolvedValue({
      launchLeadId: 'hacker-1',
      participants: [],
    });
    (getEventPermissionContext as jest.Mock).mockResolvedValue({
      actor: { role: 'HACKER' },
      chapterMembership: null,
      staff: null,
    });
    (saveProjectJudgingSubmission as jest.Mock).mockResolvedValue({
      description: 'desc',
    });
  });

  it('only lets project team members submit', async () => {
    prisma.project.findUnique.mockResolvedValue({
      launchLeadId: 'someone-else',
      participants: [],
    });
    expect((await putSubmission()).status).toBe(403);
    expect(saveProjectJudgingSubmission).not.toHaveBeenCalled();
  });

  it('requires an approved RSVP to the event', async () => {
    prisma.event.findFirst.mockResolvedValue(null);
    expect((await putSubmission()).status).toBe(403);
  });

  it('saves within the submission window for approved attendees', async () => {
    prisma.event.findFirst.mockResolvedValue({ id: eventId });
    const response = await putSubmission();
    expect(response.status).toBe(200);
    expect(saveProjectJudgingSubmission).toHaveBeenCalledWith({
      projectId: 'project-1',
      eventId,
      trackId: 't1',
      answers: { q1: 'Yes' },
      actorId: 'hacker-1',
      bypassWindow: false,
    });
  });

  it('lets MCs fix submissions outside the window', async () => {
    (getEventPermissionContext as jest.Mock).mockResolvedValue({
      actor: { role: 'HACKER' },
      chapterMembership: null,
      staff: { role: 'MC' },
    });
    await putSubmission();
    expect(prisma.event.findFirst).not.toHaveBeenCalled();
    expect(saveProjectJudgingSubmission).toHaveBeenCalledWith(
      expect.objectContaining({ bypassWindow: true })
    );
  });
});
