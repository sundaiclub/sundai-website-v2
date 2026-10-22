import { projectReadAccessWhere } from '@/lib/projectReadAccess';
import { visibleProjectsWhere } from '@/lib/projectVisibility';
import { requireEventOperationsManager } from '@/lib/eventManagementApi';
import { resolveEventJudge } from '@/lib/judgingAccess';

jest.mock('@/lib/eventManagementApi', () => ({
  requireEventOperationsManager: jest.fn(),
}));
jest.mock('@/lib/judgingAccess', () => ({ resolveEventJudge: jest.fn() }));

beforeEach(() => {
  jest.clearAllMocks();
  (requireEventOperationsManager as jest.Mock).mockResolvedValue({
    response: { status: 403 },
  });
  (resolveEventJudge as jest.Mock).mockResolvedValue(null);
});

it('does not grant access just because a request names an event', async () => {
  expect(
    await projectReadAccessWhere('outsider', 'event-1', 'invalid-token')
  ).toEqual(visibleProjectsWhere('outsider'));
});

it('limits organizer access to projects linked to the authorized event', async () => {
  (requireEventOperationsManager as jest.Mock).mockResolvedValue({
    response: null,
  });
  expect(await projectReadAccessWhere('organizer', 'event-1', null)).toEqual({
    eventParticipations: { some: { eventId: 'event-1' } },
  });
  expect(requireEventOperationsManager).toHaveBeenCalledWith('event-1');
});

it('limits a magic-link judge to assigned projects in an enabled judging event', async () => {
  (resolveEventJudge as jest.Mock).mockResolvedValue({ id: 'judge-1' });
  expect(await projectReadAccessWhere(null, 'event-1', 'valid-token')).toEqual({
    OR: [
      visibleProjectsWhere(),
      {
        judgingSubmissions: {
          some: {
            eventId: 'event-1',
            event: {
              judgingEnabled: true,
              judgingAssignmentsPublishedAt: { not: null },
            },
            assignments: { some: { judgeId: 'judge-1' } },
          },
        },
      },
    ],
  });
  expect(resolveEventJudge).toHaveBeenCalledWith('event-1', 'valid-token');
  expect(requireEventOperationsManager).not.toHaveBeenCalled();
});

it('does not allow a revoked judge to view hidden projects', async () => {
  expect(
    await projectReadAccessWhere(null, 'event-1', 'revoked-token')
  ).toEqual(visibleProjectsWhere());
});

it('uses team-only visibility without an event context', async () => {
  expect(await projectReadAccessWhere('member', null, null)).toEqual(
    visibleProjectsWhere('member')
  );
  expect(requireEventOperationsManager).not.toHaveBeenCalled();
  expect(resolveEventJudge).not.toHaveBeenCalled();
});
