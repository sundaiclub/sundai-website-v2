import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import { GET as listProjects } from '@/app/api/projects/route';
import { GET as getProject } from '@/app/api/projects/[projectId]/route';
import { GET as listHackers } from '@/app/api/hackers/route';
import { GET as getHacker } from '@/app/api/hackers/[hackerId]/route';
import { GET as getChapter } from '@/app/api/chapters/[chapterId]/route';
import { listVisibleChapters } from '@/lib/chapters';
import { visibleProjectsWhere } from '@/lib/projectVisibility';
import { getCurrentHacker } from '@/lib/eventManagementApi';

jest.mock('@clerk/nextjs/server', () => ({ auth: jest.fn() }));
jest.mock('@/lib/eventManagementApi', () => ({ getCurrentHacker: jest.fn() }));
jest.mock('@/lib/eventManagementAuth', () => ({
  canViewChapter: jest.fn().mockResolvedValue(true),
  canManageChapterSettingsWithContext: jest.fn().mockReturnValue(false),
}));
jest.mock('@/lib/projectReadAccess', () => ({
  projectReadAccessWhere: async (clerkId: string | null) =>
    require('@/lib/projectVisibility').visibleProjectsWhere(clerkId),
}));
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    project: { findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn() },
    hacker: { findUnique: jest.fn(), findMany: jest.fn() },
    chapter: { findMany: jest.fn(), findUnique: jest.fn() },
    chapterMembership: { findFirst: jest.fn() },
    event: { findMany: jest.fn() },
    judgingSubmission: { findMany: jest.fn() },
  },
}));

const db = prisma as any;
const image = {
  url: 'https://example.com/public-image.png',
  alt: 'Public image',
  filename: 'PRIVATE-filename.png',
  key: 'PRIVATE-key',
  bucket: 'PRIVATE-bucket',
  prompt: 'PRIVATE-prompt',
};
const member = {
  id: 'member-1',
  name: 'Public Name',
  bio: 'Public biography',
  avatar: image,
  email: 'PRIVATE-email@example.com',
  phoneNumber: 'PRIVATE-phone',
  clerkId: 'PRIVATE-account-id',
  role: 'PRIVATE-role',
  smsConsentAt: 'PRIVATE-consent-date',
  smsConsentVersion: 'PRIVATE-consent-version',
  attended: 'PRIVATE-attendance',
  totalMinutesAttended: 'PRIVATE-minutes',
  lastAttendance: 'PRIVATE-last-attendance',
  futurePrivateField: 'PRIVATE-future-field',
};
const project = {
  id: 'project-1',
  title: 'Public project',
  status: 'APPROVED',
  createdAt: new Date('2026-11-01T12:00:00Z'),
  updatedAt: new Date('2026-11-01T12:00:00Z'),
  thumbnail: image,
  launchLead: member,
  participants: [{ role: 'Builder', hacker: member }],
  likes: [],
  futurePrivateField: 'PRIVATE-project-field',
};
const chapter = {
  id: 'chapter-1',
  name: 'Public chapter',
  slug: 'public-chapter',
  heroImage: image,
  mailingListName: 'PRIVATE-mailing-list',
  mailingListExternalId: 'PRIVATE-mailing-id',
  defaultApprovalMessage: 'PRIVATE-approval-message',
  defaultWaitlistMessage: 'PRIVATE-waitlist-message',
  defaultRejectionMessage: 'PRIVATE-rejection-message',
  futurePrivateField: 'PRIVATE-chapter-field',
  memberships: [
    {
      id: 'membership-1',
      role: 'ADMIN',
      hacker: member,
      invitedById: 'PRIVATE-inviter',
      notificationPreferencesJson: {
        value: 'PRIVATE-notification-preferences',
      },
      smsConsentAt: 'PRIVATE-consent-date',
    },
  ],
  events: [],
};

beforeEach(() => {
  jest.clearAllMocks();
  (auth as jest.Mock).mockResolvedValue({ userId: null });
  (getCurrentHacker as jest.Mock).mockResolvedValue(null);
  db.project.findMany.mockResolvedValue([project]);
  db.project.findUnique.mockResolvedValue(project);
  db.project.count.mockResolvedValue(1);
  db.judgingSubmission.findMany.mockResolvedValue([]);
  db.hacker.findUnique.mockResolvedValue(null);
  db.event.findMany.mockResolvedValue([]);
  db.chapter.findUnique.mockResolvedValue(chapter);
  db.chapter.findMany.mockResolvedValue([chapter]);
});

it.each(['', '?limit=1', '?all=true', '?status=DRAFT'])(
  'does not expose member or storage data in project lists: %s',
  async query => {
    const response = await listProjects(
      new Request(`https://example.com/api/projects${query}`)
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await response.text()).not.toContain('PRIVATE-');
    expect(db.project.findMany.mock.calls[0][0].where.AND[0]).toMatchObject({
      status: 'APPROVED',
    });
  }
);

it('does not expose private data in project details', async () => {
  const response = await getProject(
    new Request('https://example.com/api/projects/project-1'),
    {
      params: Promise.resolve({ projectId: 'project-1' }),
    }
  );
  const body = await response.json();
  expect(body.launchLead.name).toBe('Public Name');
  expect(body.thumbnail).toEqual({ url: image.url, alt: image.alt });
  expect(JSON.stringify(body)).not.toContain('PRIVATE-');
});

it.each(['DRAFT', 'PENDING'])(
  'rejects direct public reads of %s projects',
  async status => {
    db.project.findUnique.mockImplementation(async ({ where }: any) =>
      where.AND.status === 'APPROVED' ? null : { ...project, status }
    );
    const response = await getProject(
      new Request('https://example.com/api/projects/project-1'),
      {
        params: Promise.resolve({ projectId: 'project-1' }),
      }
    );
    expect(response.status).toBe(404);
  }
);

it('preserves the thumbnail prompt for a project team member', async () => {
  (auth as jest.Mock).mockResolvedValue({ userId: 'team-account' });
  db.hacker.findUnique.mockResolvedValue({ id: member.id, role: 'HACKER' });
  const response = await getProject(
    new Request('https://example.com/api/projects/project-1'),
    {
      params: Promise.resolve({ projectId: 'project-1' }),
    }
  );
  const body = await response.json();
  expect(body.thumbnail.prompt).toBe(image.prompt);
  expect(body.launchLead).not.toHaveProperty('email');
  expect(body.thumbnail).not.toHaveProperty('bucket');
});

it.each([null, 'unrelated-account'])(
  'keeps unpublished projects private for viewer %s',
  clerkId => {
    const where = visibleProjectsWhere(clerkId);
    const publicClause = clerkId ? (where.OR as any[])[0] : where;
    expect(publicClause.status).toBe('APPROVED');
    expect(publicClause.eventParticipations).toEqual({
      none: { event: { projectsHidden: true } },
    });
    if (clerkId) {
      expect(where.OR).toEqual([
        publicClause,
        { launchLead: { clerkId } },
        { participants: { some: { hacker: { clerkId } } } },
      ]);
    }
  }
);

it('preserves site administrator moderation access', async () => {
  (auth as jest.Mock).mockResolvedValue({ userId: 'admin-account' });
  db.hacker.findUnique.mockResolvedValue({ id: 'admin', role: 'SITE_ADMIN' });
  await listProjects(new Request('https://example.com/api/projects'));
  expect(db.project.findMany.mock.calls[0][0].where.AND[0]).toEqual({});
});

it('keeps chapter administrator contacts, consent, and membership metadata private', async () => {
  const response = await getChapter(
    new Request('https://example.com/api/chapters/chapter-1'),
    {
      params: Promise.resolve({ chapterId: 'chapter-1' }),
    }
  );
  const body = await response.json();
  expect(body.memberships).toEqual([
    {
      id: 'membership-1',
      role: 'ADMIN',
      hacker: { id: member.id, name: member.name },
    },
  ]);
  expect(JSON.stringify(body)).not.toContain('PRIVATE-');
  expect(JSON.stringify(await listVisibleChapters())).not.toContain('PRIVATE-');
});

it('returns only names and IDs in the member chooser', async () => {
  (auth as jest.Mock).mockResolvedValue({ userId: 'viewer-account' });
  db.hacker.findMany.mockResolvedValue([member]);
  const response = await listHackers(
    new Request('https://example.com/api/hackers')
  );
  expect(await response.json()).toEqual([{ id: member.id, name: member.name }]);
});

it('requires sign-in and prevents lookup of another account ID', async () => {
  expect(
    (await listHackers(new Request('https://example.com/api/hackers'))).status
  ).toBe(401);
  (auth as jest.Mock).mockResolvedValue({ userId: 'viewer-account' });
  expect(
    (
      await listHackers(
        new Request('https://example.com/api/hackers?clerkId=other-account')
      )
    ).status
  ).toBe(403);
  expect(db.hacker.findMany).not.toHaveBeenCalled();
  expect(db.hacker.findUnique).not.toHaveBeenCalled();
});

it.each([null, 'unrelated-account'])(
  'removes private profile fields for viewer %s',
  async userId => {
    (auth as jest.Mock).mockResolvedValue({ userId });
    db.hacker.findUnique.mockResolvedValue({
      ...member,
      ledProjects: [project],
      projects: [],
      likes: [{ project, createdAt: new Date() }],
      featuredProjectIds: ['project-1', 'PRIVATE-hidden-project'],
    });
    const response = await getHacker(
      new Request('https://example.com/api/hackers/member-1'),
      {
        params: Promise.resolve({ hackerId: 'member-1' }),
      }
    );
    const body = await response.json();
    expect(body.featuredProjectIds).toEqual(['project-1']);
    expect(body).not.toHaveProperty('likedProjects');
    expect(JSON.stringify(body)).not.toContain('PRIVATE-');
  }
);

it('lets members read their own contact details and role', async () => {
  (auth as jest.Mock).mockResolvedValue({ userId: member.clerkId });
  db.hacker.findUnique.mockResolvedValue({
    ...member,
    ledProjects: [],
    projects: [],
    likes: [],
  });
  const response = await getHacker(
    new Request('https://example.com/api/hackers/member-1'),
    {
      params: Promise.resolve({ hackerId: 'member-1' }),
    }
  );
  const body = await response.json();
  expect(body).toMatchObject({
    email: member.email,
    phoneNumber: member.phoneNumber,
    role: member.role,
  });
  expect(body).not.toHaveProperty('clerkId');
  expect(body).not.toHaveProperty('smsConsentAt');
});
