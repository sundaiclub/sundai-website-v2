import prisma from '@/lib/prisma';
import { renderWeeklyEmail } from '@/lib/weeklyEmailTemplate';

export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const activeMembership = { status: 'ACTIVE' as const };
const subscribedMembership = {
  ...activeMembership,
  notificationsAllowed: true,
  emailNotificationsEnabled: true,
};

export function parseWeeklyEmailDraft(value: unknown) {
  if (!value || typeof value !== 'object') return null;
  const { subject, body } = value as Record<string, unknown>;
  if (typeof subject !== 'string' || typeof body !== 'string') return null;
  if (subject.length > 200 || body.length > 50000 || /[\r\n]/.test(subject))
    return null;
  return { subject: subject.trim(), body };
}

export async function loadWeeklyEmailContent(now: Date, testHackerId?: string) {
  const since = new Date(now.getTime() - WEEK_MS);
  const [recipients, projects] = await Promise.all([
    prisma.hacker.findMany({
      where: testHackerId
        ? { id: testHackerId }
        : {
            email: { not: null },
            userBans: { none: { revokedAt: null } },
            chapterMemberships: { some: subscribedMembership },
          },
      select: {
        id: true,
        name: true,
        email: true,
        chapterMemberships: {
          where: activeMembership,
          select: {
            chapter: {
              select: {
                id: true,
                name: true,
                slug: true,
                events: {
                  where: { status: 'PUBLISHED', startTime: { gt: now } },
                  orderBy: [{ startTime: 'asc' }, { id: 'asc' }],
                  take: 2,
                  select: {
                    title: true,
                    image: { select: { url: true, alt: true } },
                    slug: true,
                    startTime: true,
                    timezone: true,
                    publicLocation: true,
                    applicationsOpen: true,
                    capacity: true,
                    _count: {
                      select: {
                        registrations: {
                          where: { status: 'APPROVED', cancelledAt: null },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          orderBy: { chapterId: 'asc' },
        },
      },
      orderBy: { id: 'asc' },
    }),
    prisma.project.findMany({
      where: {
        status: 'APPROVED',
        is_broken: false,
        launchLead: { userBans: { none: { revokedAt: null } } },
        eventParticipations: {
          some: {
            event: {
              status: { in: ['PUBLISHED', 'ARCHIVED'] },
              visibility: 'PUBLIC',
              chapter: { accessMode: 'PUBLIC' },
              endTime: { gte: since, lt: now },
            },
          },
        },
      },
      select: {
        id: true,
        title: true,
        preview: true,
        thumbnail: { select: { url: true, alt: true } },
        _count: {
          select: {
            likes: {
              where: {
                createdAt: { gte: since, lt: now },
                hacker: { userBans: { none: { revokedAt: null } } },
              },
            },
          },
        },
      },
    }),
  ]);
  const topProjects = projects
    .sort((a, b) => b._count.likes - a._count.likes || a.id.localeCompare(b.id))
    .slice(0, 5);
  return {
    recipients: recipients.filter(user => user.email?.trim()),
    projects: topProjects,
  };
}

export type WeeklyEmailContent = Awaited<
  ReturnType<typeof loadWeeklyEmailContent>
>;

export function buildWeeklyEmails(
  draft: { subject: string; body: string },
  content: WeeklyEmailContent
) {
  return content.recipients.map(recipient => ({
    to: recipient.email!,
    subject: draft.subject,
    ...renderWeeklyEmail(draft, recipient, content.projects),
  }));
}
