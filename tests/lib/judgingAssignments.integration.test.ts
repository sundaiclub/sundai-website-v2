/**
 * @jest-environment jsdom
 * @jest-environment-options {"customExportConditions": ["node", "node-addons"]}
 */
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import prisma from '@/lib/prisma';
import { hashJudgeToken } from '@/lib/judgingAccess';
import { projectReadAccessWhere } from '@/lib/projectReadAccess';
import {
  loadJudgePanel,
  loadJudgingAssignments,
  loadJudgingConfig,
  loadJudgingResults,
  saveJudgeReview,
  saveJudgingConfig,
  saveProjectJudgingSubmission,
  upsertEventJudge,
  updateEventJudge,
} from '@/lib/judgingData';
import type { JudgingConfigInput } from '@/types/judging';

jest.mock('next/headers', () => ({ cookies: jest.fn() }));
jest.mock('@clerk/nextjs/server', () => ({ auth: jest.fn() }));
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: new (require('@prisma/client').PrismaClient)({
    datasources: {
      db: {
        url:
          process.env.JUDGING_TEST_DATABASE_URL ||
          'postgresql://unused@127.0.0.1:1/judging_assignments_test',
      },
    },
  }),
}));

const databaseUrl = process.env.JUDGING_TEST_DATABASE_URL;
const integrationTest = databaseUrl ? it : it.skip;
beforeAll(() => {
  if (!databaseUrl) return;
  const url = new URL(databaseUrl);
  if (
    !['localhost', '127.0.0.1'].includes(url.hostname) ||
    url.pathname !== '/judging_assignments_test'
  ) {
    throw new Error('Use a local judging_assignments_test database.');
  }
});
afterAll(async () => {
  await prisma.$disconnect();
});

integrationTest(
  'migrates existing reviews without changing an active judge list',
  async () => {
    const rollback = new Error('Rollback migration test');
    await expect(
      prisma.$transaction(
        async tx => {
          const key = randomUUID();
          const lead = await tx.hacker.create({
            data: { name: 'Migration test', clerkId: key },
          });
          const chapter = await tx.chapter.create({
            data: {
              name: 'Migration test',
              slug: key,
              city: 'Boston',
              country: 'US',
              timezone: 'UTC',
            },
          });
          const data = {
            title: 'Migration test',
            timezone: 'UTC',
            chapterId: chapter.id,
            createdById: lead.id,
            startTime: new Date(),
            judgingEnabled: true,
            judgingOpen: true,
          };
          const started = await tx.event.create({
            data: { ...data, slug: key },
          });
          const pending = await tx.event.create({
            data: { ...data, slug: `${key}-pending` },
          });
          const track = await tx.judgingTrack.create({
            data: { eventId: started.id, name: 'General' },
          });
          const judge = await tx.eventJudge.create({
            data: {
              eventId: started.id,
              name: 'Active judge',
              email: 'active@example.com',
              tokenHash: randomUUID(),
              invitedById: lead.id,
              tracks: { create: { trackId: track.id } },
            },
          });
          const revoked = await tx.eventJudge.create({
            data: {
              eventId: started.id,
              name: 'Old judge',
              email: 'old@example.com',
              tokenHash: randomUUID(),
              invitedById: lead.id,
              revokedAt: new Date(),
            },
          });
          const project = await tx.project.create({
            data: { title: 'Reviewed', launchLeadId: lead.id },
          });
          const submission = await tx.judgingSubmission.create({
            data: {
              eventId: started.id,
              projectId: project.id,
              trackId: track.id,
              submittedById: lead.id,
              answersJson: {},
            },
          });
          const criterion = await tx.judgingCriterion.create({
            data: { eventId: started.id, name: 'Idea' },
          });
          await tx.judgingReview.create({
            data: {
              judgeId: revoked.id,
              submissionId: submission.id,
              scores: { create: { criterionId: criterion.id, score: 4 } },
            },
          });

          await tx.$executeRawUnsafe('DROP TABLE "JudgingAssignment"');
          await tx.$executeRawUnsafe(
            'ALTER TABLE "Event" DROP COLUMN "judgesPerProject", DROP COLUMN "judgingAssignmentsPublishedAt", ALTER COLUMN "judgingOpen" SET DEFAULT true'
          );
          const migration = readFileSync(
            join(
              process.cwd(),
              'prisma/migrations/20261022020000_judging_assignments/migration.sql'
            ),
            'utf8'
          );
          for (const statement of migration
            .split(';')
            .filter(part => part.trim()))
            await tx.$executeRawUnsafe(statement);

          expect(
            await tx.event.findUnique({ where: { id: started.id } })
          ).toMatchObject({
            judgingOpen: true,
            judgesPerProject: 1,
            judgingAssignmentsPublishedAt: expect.any(Date),
          });
          expect(
            await tx.event.findUnique({ where: { id: pending.id } })
          ).toMatchObject({
            judgingOpen: false,
            judgingAssignmentsPublishedAt: null,
          });
          const assignments = await tx.judgingAssignment.findMany({
            where: { submissionId: submission.id },
          });
          expect(assignments.map(item => item.judgeId).sort()).toEqual(
            [judge.id, revoked.id].sort()
          );
          expect(
            await tx.judgingReviewScore.findMany({
              where: { criterionId: criterion.id },
            })
          ).toMatchObject([{ score: 4 }]);
          throw rollback;
        },
        { timeout: 15000 }
      )
    ).rejects.toBe(rollback);
  }
);

integrationTest(
  'publishes a complete, balanced roster atomically and enforces saved assignments',
  async () => {
    const url = new URL(databaseUrl!);
    if (
      !['localhost', '127.0.0.1'].includes(url.hostname) ||
      url.pathname !== '/judging_assignments_test'
    ) {
      throw new Error('Use a local judging_assignments_test database.');
    }
    const key = randomUUID();
    const lead = await prisma.hacker.create({
      data: { name: 'Test organizer', clerkId: key },
    });
    const chapter = await prisma.chapter.create({
      data: {
        name: 'Judging test',
        slug: key,
        city: 'Boston',
        country: 'US',
        timezone: 'America/New_York',
      },
    });
    const event = await prisma.event.create({
      data: {
        title: 'Judging test',
        slug: key,
        chapterId: chapter.id,
        createdById: lead.id,
        startTime: new Date(Date.now() - 7200000),
        endTime: new Date(Date.now() + 3600000),
        timezone: chapter.timezone,
        judgingEnabled: true,
        judgesPerProject: 1,
        projectsHidden: true,
      },
    });
    const projectIds: string[] = [];
    try {
      const a = await prisma.judgingTrack.create({
        data: { eventId: event.id, name: 'A', position: 0 },
      });
      const b = await prisma.judgingTrack.create({
        data: { eventId: event.id, name: 'B', position: 1 },
      });
      const common = await prisma.judgingCriterion.create({
        data: { eventId: event.id, name: 'Idea' },
      });
      const extra = await prisma.judgingCriterion.create({
        data: { eventId: event.id, trackId: a.id, name: 'Depth' },
      });
      for (const track of [a, b]) {
        for (let i = 0; i < 6; i += 1) {
          const project = await prisma.project.create({
            data: {
              title: `${track.name} ${i}`,
              launchLeadId: lead.id,
              status: 'APPROVED',
              eventParticipations: {
                create: { eventId: event.id, addedById: lead.id },
              },
              judgingSubmissions: {
                create: {
                  eventId: event.id,
                  trackId: track.id,
                  submittedById: lead.id,
                  answersJson: {},
                },
              },
            },
          });
          projectIds.push(project.id);
        }
      }
      const invite = (name: string, trackIds: string[]) =>
        upsertEventJudge({
          eventId: event.id,
          actorId: lead.id,
          hackerId: null,
          email: `${name}@example.com`,
          name,
          trackIds,
        });
      const aJudge = await invite('a-only', [a.id]);
      const token = randomUUID();
      await prisma.eventJudge.update({
        where: { id: aJudge },
        data: { tokenHash: hashJudgeToken(token) },
      });
      expect(
        await prisma.project.count({
          where: {
            AND: [
              { id: { in: projectIds } },
              await projectReadAccessWhere(null, event.id, token),
            ],
          },
        })
      ).toBe(0);
      const firstDraft = await loadJudgingAssignments(event.id);
      expect(firstDraft.judges[0].total).toBe(6);
      expect(firstDraft.shortages).toEqual([
        { trackId: b.id, trackName: 'B', eligible: 0, required: 1 },
      ]);
      const config = (await loadJudgingConfig(event.id))!;
      const input: JudgingConfigInput = { ...config, judgingOpen: true };
      await expect(saveJudgingConfig(event.id, input)).rejects.toThrow(
        'Close project submissions'
      );
      input.judgingSubmissionsCloseAt = new Date(
        Date.now() - 3600000
      ).toISOString();
      await expect(saveJudgingConfig(event.id, input)).rejects.toThrow(
        'B needs 1 judges but has 0.'
      );
      const rolledBack = (await loadJudgingConfig(event.id))!;
      expect(rolledBack.judgingOpen).toBe(false);
      expect(rolledBack.judgingSubmissionsCloseAt).toBeNull();
      expect(
        await prisma.judgingAssignment.count({
          where: { submission: { eventId: event.id } },
        })
      ).toBe(0);

      await invite('b-only', [b.id]);
      const shared = await invite('shared', [a.id, b.id]);
      const draft = await loadJudgingAssignments(event.id);
      expect(draft.shortages).toHaveLength(0);
      expect(draft.judges.map(judge => judge.total)).toEqual([4, 4, 4]);
      expect(
        draft.judges.find(judge => judge.id === shared)?.trackCounts
      ).toEqual({ [a.id]: 2, [b.id]: 2 });
      expect(
        (await loadJudgePanel(event.id, aJudge))?.tracks[0].projects
      ).toHaveLength(0);
      expect(
        await prisma.judgingAssignment.count({
          where: { submission: { eventId: event.id } },
        })
      ).toBe(0);

      await expect(
        saveJudgingConfig(event.id, {
          ...input,
          criteria: [],
          tracks: input.tracks.map(track => ({ ...track, criteria: [] })),
        })
      ).rejects.toThrow('Add scoring criteria');
      expect(
        await prisma.judgingCriterion.count({ where: { eventId: event.id } })
      ).toBe(2);

      // Concurrent opens serialize and cannot create duplicate assignments.
      await Promise.all([
        saveJudgingConfig(event.id, input),
        saveJudgingConfig(event.id, input),
      ]);
      const saved = await loadJudgingAssignments(event.id);
      expect(saved).toEqual({ ...draft, published: true });
      expect(
        await prisma.judgingAssignment.count({
          where: { submission: { eventId: event.id } },
        })
      ).toBe(12);
      const panel = (await loadJudgePanel(event.id, aJudge))!;
      expect(panel.assignmentsPublished).toBe(true);
      expect(panel.tracks[0].projects).toHaveLength(4);
      const readable = await prisma.project.findMany({
        where: {
          AND: [
            { id: { in: projectIds } },
            await projectReadAccessWhere(null, event.id, token),
          ],
        },
        select: { id: true },
      });
      expect(readable.map(project => project.id).sort()).toEqual(
        panel.tracks[0].projects.map(project => project.projectId).sort()
      );
      const assigned = panel.tracks[0].projects[0];
      const outside = saved.projects.find(
        project =>
          project.trackId === a.id &&
          !panel.tracks[0].projects.some(
            item => item.submissionId === project.id
          )
      )!;
      const reviewInput = {
        eventId: event.id,
        judgeId: aJudge,
        submissionId: assigned.submissionId,
        comment: 'Test',
      };
      await expect(
        saveJudgeReview({
          ...reviewInput,
          submissionId: outside.id,
          scores: { [common.id]: 4, [extra.id]: 3 },
        })
      ).rejects.toMatchObject({ status: 404 });
      await saveJudgeReview({ ...reviewInput, scores: { [common.id]: 4 } });
      let row = (await loadJudgingResults(event.id)).overall.find(
        row => row.submissionId === assigned.submissionId
      )!;
      expect(row).toMatchObject({
        judgeCount: 0,
        assignedJudgeCount: 1,
        requiredJudgeCount: 1,
        rawScore: null,
        criterionAverages: {},
      });
      expect(
        (await loadJudgingAssignments(event.id)).projects.find(
          project => project.id === assigned.submissionId
        )?.completed
      ).toBe(0);
      await saveJudgeReview({
        ...reviewInput,
        scores: { [common.id]: 4, [extra.id]: 2 },
      });
      row = (await loadJudgingResults(event.id)).overall.find(
        row => row.submissionId === assigned.submissionId
      )!;
      expect(row).toMatchObject({ judgeCount: 1, rawScore: 3 });
      expect(
        (await loadJudgingConfig(event.id))!.judges.find(
          judge => judge.id === aJudge
        )?.reviewCount
      ).toBe(1);
      expect(
        (await loadJudgingAssignments(event.id)).projects.find(
          project => project.id === assigned.submissionId
        )?.completed
      ).toBe(1);

      await expect(invite('too-late', [a.id])).rejects.toThrow(
        'Assignments are fixed'
      );
      await expect(
        updateEventJudge({
          eventId: event.id,
          judgeId: aJudge,
          trackIds: [b.id],
        })
      ).rejects.toThrow('Assignments are fixed');
      await expect(
        saveJudgingConfig(event.id, { ...input, judgesPerProject: 2 })
      ).rejects.toThrow('fixed because scoring has started');
      await expect(
        saveProjectJudgingSubmission({
          eventId: event.id,
          projectId: assigned.projectId,
          trackId: b.id,
          answers: {},
          actorId: lead.id,
          bypassWindow: true,
        })
      ).rejects.toThrow('Project assignments are fixed');
      await saveJudgingConfig(event.id, { ...input, judgingOpen: false });
      await expect(
        saveJudgeReview({ ...reviewInput, scores: { [common.id]: 3 } })
      ).rejects.toThrow('Judging is closed');
      const assignments = await prisma.judgingAssignment.findMany({
        where: { submission: { eventId: event.id } },
        orderBy: [{ judgeId: 'asc' }, { submissionId: 'asc' }],
      });
      await saveJudgingConfig(event.id, input);
      expect(
        await prisma.judgingAssignment.findMany({
          where: { submission: { eventId: event.id } },
          orderBy: [{ judgeId: 'asc' }, { submissionId: 'asc' }],
        })
      ).toEqual(assignments);
    } finally {
      await prisma.eventProject.deleteMany({ where: { eventId: event.id } });
      await prisma.judgingSubmission.deleteMany({
        where: { eventId: event.id },
      });
      await prisma.event.delete({ where: { id: event.id } });
      await prisma.project.deleteMany({ where: { id: { in: projectIds } } });
      await prisma.chapter.delete({ where: { id: chapter.id } });
      await prisma.hacker.delete({ where: { id: lead.id } });
    }
  },
  30000
);
