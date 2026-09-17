import {
  deliverWeeklyEmail,
  loadWeeklyEmailContent,
  parseWeeklyEmailDraft,
  WEEK_MS,
} from '@/lib/weeklyEmails';
import {
  renderEmailMarkdown,
  renderWeeklyEmail,
} from '@/lib/weeklyEmailTemplate';
import type { WeeklyEmailContent } from '@/lib/weeklyEmails';
import prisma from '@/lib/prisma';

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    hacker: { findMany: jest.fn() },
    project: { findMany: jest.fn() },
  },
}));
const db = prisma as unknown as {
  hacker: { findMany: jest.Mock };
  project: { findMany: jest.Mock };
};
const now = new Date('2026-09-17T16:00:00Z');
const chapter = (id: string, events: unknown[] = []) => ({
  chapter: { id, name: id, slug: id, events },
});
const recipient = {
  id: 'user',
  name: 'Andrew Mead',
  email: 'andrew@example.com',
  chapterMemberships: [
    chapter('boston', [
      {
        title: 'Build <together>',
        slug: 'build',
        startTime: now,
        timezone: 'America/New_York',
        publicLocation: 'Cambridge',
        applicationsOpen: false,
        capacity: null,
        _count: { registrations: 0 },
      },
    ]),
    chapter('empty'),
  ],
} as WeeklyEmailContent['recipients'][number];

describe('weekly emails', () => {
  beforeEach(() => jest.clearAllMocks());

  it('uses existing preferences for eligibility but all active memberships for events', async () => {
    db.hacker.findMany.mockResolvedValue([recipient]);
    db.project.findMany.mockResolvedValue([]);
    await loadWeeklyEmailContent(now);
    const query = db.hacker.findMany.mock.calls[0][0];
    expect(query.where.chapterMemberships.some).toEqual({
      status: 'ACTIVE',
      notificationsAllowed: true,
      emailNotificationsEnabled: true,
    });
    expect(query.where.userBans).toEqual({ none: { revokedAt: null } });
    expect(query.select.chapterMemberships.where).toEqual({ status: 'ACTIVE' });
    expect(
      query.select.chapterMemberships.select.chapter.select.events
    ).toMatchObject({
      where: { status: 'PUBLISHED', startTime: { gt: now } },
      take: 2,
    });
  });

  it('selects five projects by recent likes with stable ties and the same rolling event window', async () => {
    db.hacker.findMany.mockResolvedValue([]);
    db.project.findMany.mockResolvedValue(
      [2, 6, 1, 5, 4, 3, 0].map(likes => ({
        id: String(likes),
        title: 'Project',
        preview: null,
        _count: { likes },
      }))
    );
    const content = await loadWeeklyEmailContent(now);
    expect(content.projects.map(project => project.id)).toEqual([
      '6',
      '5',
      '4',
      '3',
      '2',
    ]);
    const query = db.project.findMany.mock.calls[0][0];
    const range = { gte: new Date(now.getTime() - WEEK_MS), lt: now };
    expect(query.where.eventParticipations.some.event).toMatchObject({
      endTime: range,
      visibility: 'PUBLIC',
      chapter: { accessMode: 'PUBLIC' },
    });
    expect(query.select._count.select.likes.where.createdAt).toEqual(range);
    expect(query.where.status).toBe('APPROVED');
  });

  it('allows self tests even when the admin has no email subscription', async () => {
    db.hacker.findMany.mockResolvedValue([recipient]);
    db.project.findMany.mockResolvedValue([]);
    await loadWeeklyEmailContent(now, 'admin');
    expect(db.hacker.findMany.mock.calls[0][0].where).toEqual({ id: 'admin' });
  });

  it('renders first names, public event details, and omits empty sections', () => {
    const result = renderWeeklyEmail(
      { subject: 'Weekly <news>', body: '**Hello**' },
      recipient,
      []
    );
    expect(result.html).toContain('Hi Andrew,');
    expect(result.html).toContain('<strong>Hello</strong>');
    expect(result.html).toContain('Build &lt;together&gt;');
    expect(result.html).toContain('Registration closed');
    expect(result.html).not.toContain('Top projects this week');
    expect(result.html).not.toContain('<strong>empty</strong>');
    expect(result.body).toContain('/events/boston/build');
    expect(
      renderWeeklyEmail(
        { subject: 'Hi', body: 'Welcome' },
        { ...recipient, name: '', chapterMemberships: [] },
        []
      ).html
    ).toContain('Hi there,');
  });

  it('escapes HTML and blocks executable links while supporting Markdown', () => {
    const html = renderEmailMarkdown(
      '# Heading\n\n<script>alert(1)</script>\n\n[bad](javascript:alert(1))\n\n![Photo](https://example.com/photo.png)\n\n1. One\n2. Two\n\n~~old~~'
    );
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('href="javascript:');
    expect(html).toContain('<h1>Heading</h1>');
    expect(html).toContain('max-width:100%');
    expect(html).toContain('<ol>');
    expect(html).toContain('<s>old</s>');
  });

  it('sends independently to each member and continues after a provider failure', async () => {
    const send = jest
      .fn()
      .mockRejectedValueOnce(new Error('SES failure'))
      .mockResolvedValue({ status: 'SENT' });
    expect(
      await deliverWeeklyEmail(
        { subject: 'News', body: 'Hello' },
        {
          recipients: [
            recipient,
            {
              ...recipient,
              id: 'second',
              email: 'second@example.com',
              name: 'Pat Smith',
            },
          ],
          projects: [],
        },
        send
      )
    ).toEqual({ sent: 1, failed: 1 });
    expect(send).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        to: 'second@example.com',
        html: expect.stringContaining('Hi Pat,'),
      })
    );
  });

  it('limits input and rejects header injection while allowing incomplete drafts', () => {
    expect(parseWeeklyEmailDraft({ subject: '', body: '' })).toEqual({
      subject: '',
      body: '',
    });
    expect(
      parseWeeklyEmailDraft({ subject: 'Hi\nBcc: person', body: 'Hi' })
    ).toBeNull();
    expect(
      parseWeeklyEmailDraft({ subject: 'Hi', body: 'x'.repeat(50001) })
    ).toBeNull();
    expect(parseWeeklyEmailDraft(null)).toBeNull();
  });
});
