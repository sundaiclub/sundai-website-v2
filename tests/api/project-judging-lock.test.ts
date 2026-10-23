import { auth } from '@clerk/nextjs/server';
import { NextRequest } from 'next/server';
import prisma from '../../src/lib/prisma';
import { PATCH as edit } from '../../src/app/api/projects/[projectId]/edit/route';
import { PATCH as submit } from '../../src/app/api/projects/[projectId]/submit/route';
import {
  DELETE as remove,
  GET as getProject,
} from '../../src/app/api/projects/[projectId]/route';
import {
  POST as join,
  DELETE as leave,
} from '../../src/app/api/projects/[projectId]/join/route';
import { DELETE as removeMember } from '../../src/app/api/projects/[projectId]/participants/[hackerId]/route';
import { PUT as saveAnswers } from '../../src/app/api/projects/[projectId]/judging/route';
import { PROJECT_JUDGING_LOCK_MESSAGE } from '../../src/lib/judging';

jest.mock('@clerk/nextjs/server', () => ({ auth: jest.fn() }));
jest.mock('../../src/lib/eventManagementApi', () => ({
  getCurrentHacker: () =>
    require('../../src/lib/prisma').default.hacker.findUnique(),
  unauthorized: jest.fn(),
}));
jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    hacker: { findUnique: jest.fn() },
    project: { findUnique: jest.fn(), update: jest.fn(), delete: jest.fn() },
    judgingSubmission: { findMany: jest.fn() },
    projectToParticipant: {
      create: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    image: { create: jest.fn() },
    pitchProject: { findMany: jest.fn() },
    event: { findMany: jest.fn() },
  },
}));
const db = prisma as any;
const context = { params: { projectId: 'project-1', hackerId: 'member-1' } };
const now = new Date('2026-10-23T18:00:00Z');
const event = {
  judgingEnabled: true,
  judgingOpen: false,
  judgingAssignmentsPublishedAt: null as Date | null,
  startTime: new Date('2026-10-23T12:00:00Z'),
  endTime: new Date('2026-10-23T20:00:00Z'),
  judgingSubmissionsOpenAt: null,
  judgingSubmissionsCloseAt: new Date('2026-10-23T17:00:00Z'),
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers().setSystemTime(now);
  (auth as jest.Mock).mockReturnValue({ userId: 'clerk-1' });
  db.hacker.findUnique.mockResolvedValue({ id: 'lead-1', role: 'HACKER' });
  db.project.findUnique.mockResolvedValue({
    id: 'project-1',
    launchLeadId: 'lead-1',
    status: 'APPROVED',
    participants: [],
    likes: [],
  });
  db.judgingSubmission.findMany.mockResolvedValue([{ event }]);
});
afterEach(() => jest.useRealTimers());

const mutations = [
  ['edit details and team', edit, 'PATCH', '/edit', null],
  ['change status', submit, 'PATCH', '/submit', { status: 'DRAFT' }],
  [
    'remove event participation',
    submit,
    'PATCH',
    '/submit',
    { status: 'APPROVED', removedEventIds: ['event-1'] },
  ],
  ['delete project', remove, 'DELETE', '', null],
  ['join team', join, 'POST', '/join', { role: 'Developer' }],
  ['leave team', leave, 'DELETE', '/join', null],
  [
    'remove team member',
    removeMember,
    'DELETE',
    '/participants/member-1',
    null,
  ],
  [
    'change judging answers',
    saveAnswers,
    'PUT',
    '/judging',
    { eventId: 'event-1', trackId: 'track-1' },
  ],
] as const;

it.each(mutations)(
  'blocks requests to %s after submissions close, before scoring starts',
  async (_name, handler, method, suffix, body) => {
    const request = new NextRequest(
      `http://localhost/api/projects/project-1${suffix}`,
      {
        method,
        ...(body ? { body: JSON.stringify(body) } : {}),
      }
    );
    const response = await handler(request, context);
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      message: PROJECT_JUDGING_LOCK_MESSAGE,
    });
    expect(db.project.update).not.toHaveBeenCalled();
    expect(db.project.delete).not.toHaveBeenCalled();
    expect(db.projectToParticipant.create).not.toHaveBeenCalled();
    expect(db.projectToParticipant.delete).not.toHaveBeenCalled();
    expect(db.projectToParticipant.deleteMany).not.toHaveBeenCalled();
    expect(db.image.create).not.toHaveBeenCalled();
  }
);

it('blocks a team member during scoring', async () => {
  db.hacker.findUnique.mockResolvedValue({ id: 'member-1', role: 'HACKER' });
  db.project.findUnique.mockResolvedValue({
    launchLeadId: 'lead-1',
    participants: [{ hacker: { id: 'member-1' } }],
  });
  db.judgingSubmission.findMany.mockResolvedValue([
    {
      event: {
        ...event,
        judgingOpen: true,
        judgingAssignmentsPublishedAt: now,
      },
    },
  ]);
  expect(
    (
      await edit(
        new NextRequest('http://localhost/edit', { method: 'PATCH' }),
        context
      )
    ).status
  ).toBe(409);
});

it.each([
  [
    'before the deadline',
    [
      {
        event: {
          ...event,
          judgingSubmissionsCloseAt: new Date('2026-10-23T19:00:00Z'),
        },
      },
    ],
  ],
  [
    'after scoring concludes',
    [{ event: { ...event, judgingAssignmentsPublishedAt: now } }],
  ],
  ['without a judging submission', []],
  ['with judging disabled', [{ event: { ...event, judgingEnabled: false } }]],
])('allows edits %s', async (_name, submissions) => {
  db.judgingSubmission.findMany.mockResolvedValue(submissions);
  db.project.update.mockResolvedValue({ id: 'project-1' });
  const response = await edit(
    new NextRequest('http://localhost/edit', {
      method: 'PATCH',
      body: new FormData(),
    }),
    context
  );
  expect(response.status).toBe(200);
  expect(db.project.update).toHaveBeenCalled();
});

it('keeps site admin corrections available', async () => {
  db.hacker.findUnique.mockResolvedValue({ id: 'admin-1', role: 'SITE_ADMIN' });
  db.project.update.mockResolvedValue({ id: 'project-1' });
  expect(
    (
      await edit(
        new NextRequest('http://localhost/edit', {
          method: 'PATCH',
          body: new FormData(),
        }),
        context
      )
    ).status
  ).toBe(200);
  expect(db.judgingSubmission.findMany).not.toHaveBeenCalled();
});

it('exposes the lock on the project API without exposing event data', async () => {
  const response = await getProject(
    new NextRequest('http://localhost/api/projects/project-1'),
    context
  );
  const body = await response.json();
  expect(body.editLockedForJudging).toBe(true);
  expect(body.judgingSubmissions).toBeUndefined();
});
