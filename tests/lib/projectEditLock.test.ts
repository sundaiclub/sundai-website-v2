import { isProjectLockedForJudging } from '../../src/lib/judging';
import { isProjectEditLocked } from '../../src/lib/projectEditLock';

jest.mock('../../src/lib/prisma', () => ({ __esModule: true, default: {} }));
const now = new Date('2026-10-23T18:00:00Z');
const event = {
  judgingEnabled: true,
  judgingOpen: false,
  judgingAssignmentsPublishedAt: null as Date | null,
  startTime: new Date('2026-10-23T12:00:00Z'),
  endTime: new Date('2026-10-23T17:00:00Z'),
  judgingSubmissionsOpenAt: null,
  judgingSubmissionsCloseAt: null as Date | null,
};

it('uses the event end when there is no custom submission deadline', () => {
  expect(isProjectLockedForJudging(event, now)).toBe(true);
});
it('uses the custom deadline in place of the event end', () => {
  expect(
    isProjectLockedForJudging(
      { ...event, judgingSubmissionsCloseAt: new Date('2026-10-23T19:00:00Z') },
      now
    )
  ).toBe(false);
});
it('keeps the deadline inclusive, as required by the submission window', () => {
  expect(isProjectLockedForJudging(event, event.endTime)).toBe(false);
  expect(
    isProjectLockedForJudging(event, new Date(event.endTime.getTime() + 1))
  ).toBe(true);
});
it('does not lock an event without a closing time', () => {
  expect(isProjectLockedForJudging({ ...event, endTime: null }, now)).toBe(
    false
  );
});
it('locks the project again when scoring reopens', () => {
  expect(
    isProjectLockedForJudging(
      { ...event, judgingAssignmentsPublishedAt: now, judgingOpen: true },
      now
    )
  ).toBe(true);
});
it('keeps a project locked if any submitted event still needs judging', async () => {
  const db = {
    judgingSubmission: {
      findMany: jest
        .fn()
        .mockResolvedValue([
          { event: { ...event, judgingAssignmentsPublishedAt: now } },
          { event },
        ]),
    },
  };
  jest.useFakeTimers().setSystemTime(now);
  try {
    expect(await isProjectEditLocked('project-1', db as any)).toBe(true);
    expect(db.judgingSubmission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { projectId: 'project-1' } })
    );
  } finally {
    jest.useRealTimers();
  }
});
