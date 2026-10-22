/**
 * @jest-environment jsdom
 * @jest-environment-options {"customExportConditions": ["node", "node-addons"]}
 */
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';
import { visibleProjectsWhere } from '@/lib/projectVisibility';

// Run against a disposable database after applying prisma/schema.prisma.
const databaseUrl = process.env.PROJECT_VISIBILITY_TEST_DATABASE_URL;
const integrationTest = databaseUrl ? it : it.skip;

integrationTest(
  'enforces team access, publication, and isolation across events in PostgreSQL',
  async () => {
    const url = new URL(databaseUrl!);
    if (
      !['localhost', '127.0.0.1'].includes(url.hostname) ||
      url.pathname !== '/project_visibility_test'
    ) {
      throw new Error('Use a local project_visibility_test database.');
    }
    const db = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    const rollback = new Error('Roll back visibility test fixtures');
    try {
      await db.$transaction(
        async tx => {
          const key = randomUUID();
          const lead = await tx.hacker.create({
            data: { name: 'Lead', clerkId: `${key}-lead` },
          });
          const member = await tx.hacker.create({
            data: { name: 'Member', clerkId: `${key}-member` },
          });
          const outsider = await tx.hacker.create({
            data: { name: 'Other team', clerkId: `${key}-other` },
          });
          const chapter = await tx.chapter.create({
            data: {
              name: 'Test chapter',
              slug: key,
              city: 'Boston',
              country: 'US',
              timezone: 'America/New_York',
            },
          });
          const event = await tx.event.create({
            data: {
              title: 'Hidden event',
              slug: key,
              chapterId: chapter.id,
              createdById: lead.id,
              startTime: new Date(),
              timezone: chapter.timezone,
              judgingEnabled: true,
              projectsHidden: true,
            },
          });
          const otherEvent = await tx.event.create({
            data: {
              title: 'Public event',
              slug: `${key}-other`,
              chapterId: chapter.id,
              createdById: lead.id,
              startTime: new Date(),
              timezone: chapter.timezone,
            },
          });
          const hidden = await tx.project.create({
            data: {
              title: 'Hidden project',
              launchLeadId: lead.id,
              status: 'APPROVED',
              participants: { create: { hackerId: member.id } },
              eventParticipations: {
                create: [
                  { eventId: event.id, addedById: lead.id },
                  { eventId: otherEvent.id, addedById: lead.id },
                ],
              },
            },
          });
          const publicProject = await tx.project.create({
            data: {
              title: 'Public project',
              launchLeadId: outsider.id,
              status: 'APPROVED',
              eventParticipations: {
                create: { eventId: otherEvent.id, addedById: lead.id },
              },
            },
          });
          const fixtureIds = [hidden.id, publicProject.id];

          for (const clerkId of [
            null,
            outsider.clerkId,
            lead.clerkId,
            member.clerkId,
          ]) {
            const teamMember =
              clerkId === lead.clerkId || clerkId === member.clerkId;
            const where = {
              id: { in: fixtureIds },
              AND: visibleProjectsWhere(clerkId),
            };
            expect(await tx.project.count({ where })).toBe(teamMember ? 2 : 1);
            const projects = await tx.project.findMany({ where });
            expect(projects.some(project => project.id === hidden.id)).toBe(
              teamMember
            );
            const directProject = await tx.project.findUnique({
              where: { id: hidden.id, AND: visibleProjectsWhere(clerkId) },
            });
            expect(Boolean(directProject)).toBe(teamMember);
            const profile = await tx.hacker.findUnique({
              where: { id: lead.id },
              include: {
                ledProjects: { where: visibleProjectsWhere(clerkId) },
              },
            });
            expect(
              profile!.ledProjects.some(project => project.id === hidden.id)
            ).toBe(teamMember);
            const otherEventProjects = await tx.eventProject.findMany({
              where: {
                eventId: otherEvent.id,
                project: visibleProjectsWhere(clerkId),
              },
            });
            expect(
              otherEventProjects.some(row => row.projectId === hidden.id)
            ).toBe(teamMember);
          }

          // Disabling scoring or judging does not publish projects by accident.
          await tx.event.update({
            where: { id: event.id },
            data: { judgingOpen: false, judgingEnabled: false },
          });
          expect(
            await tx.project.findUnique({
              where: { id: hidden.id, AND: visibleProjectsWhere() },
            })
          ).toBeNull();
          // The visibility switch publishes immediately for signed-out visitors.
          await tx.event.update({
            where: { id: event.id },
            data: { projectsHidden: false },
          });
          expect(
            await tx.project.findUnique({
              where: { id: hidden.id, AND: visibleProjectsWhere() },
            })
          ).not.toBeNull();
          // Hiding again takes effect immediately and only affects that event's projects.
          await tx.event.update({
            where: { id: event.id },
            data: { projectsHidden: true },
          });
          expect(
            await tx.project.count({
              where: { id: { in: fixtureIds }, AND: visibleProjectsWhere() },
            })
          ).toBe(1);
          // Verify the cutover hides existing judged events and leaves other events public.
          await tx.event.update({
            where: { id: event.id },
            data: { judgingEnabled: true },
          });
          await tx.$executeRawUnsafe(
            'ALTER TABLE "Event" DROP COLUMN "projectsHidden"'
          );
          const migration = readFileSync(
            join(
              process.cwd(),
              'prisma/migrations/20261022000000_event_project_visibility/migration.sql'
            ),
            'utf8'
          );
          for (const statement of migration
            .split(';')
            .map(sql => sql.trim())
            .filter(Boolean)) {
            await tx.$executeRawUnsafe(statement);
          }
          expect(
            (await tx.event.findUniqueOrThrow({ where: { id: event.id } }))
              .projectsHidden
          ).toBe(true);
          expect(
            (await tx.event.findUniqueOrThrow({ where: { id: otherEvent.id } }))
              .projectsHidden
          ).toBe(false);
          throw rollback;
        },
        { timeout: 20000 }
      );
    } catch (error) {
      if (error !== rollback) throw error;
    } finally {
      await db.$disconnect();
    }
  },
  30000
);
