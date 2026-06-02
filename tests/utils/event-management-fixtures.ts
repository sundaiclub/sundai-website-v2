import type {
  BanFlagStatus,
  ChapterAccessMode,
  ChapterMembershipStatus,
  ChapterRole,
  ChapterStatus,
  EventStaffRole,
  JsonObject,
  JsonValue,
  Role,
} from '../../src/types/event-management';

export type FixtureOverrides<T> = Partial<T>;

type EventManagementRole = Role;
type ChapterMembershipRole = ChapterRole;
type UserBanFlagStatus = BanFlagStatus;

export type HackerFixture = {
  id: string;
  clerkId: string;
  name: string;
  username: string | null;
  role: EventManagementRole | null;
  bio: string | null;
  githubUrl: string | null;
  discordName: string | null;
  twitterUrl: string | null;
  linkedinUrl: string | null;
  websiteUrl: string | null;
  email: string | null;
  phoneNumber: string | null;
  attended: number;
  avatarId: string | null;
  featuredProjectIds: string[];
  totalMinutesAttended: number;
  lastAttendance: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ChapterFixture = {
  id: string;
  name: string;
  slug: string;
  city: string;
  region: string;
  country: string;
  timezone: string;
  description: string | null;
  status: ChapterStatus;
  accessMode: ChapterAccessMode;
  defaultDeclineMessage: string | null;
  mailingListName: string | null;
  mailingListExternalId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type ChapterMembershipFixture = {
  id: string;
  chapterId: string;
  hackerId: string;
  role: ChapterMembershipRole;
  status: ChapterMembershipStatus;
  invitedById: string | null;
  invitedAt: Date | null;
  joinedAt: Date | null;
  leftAt: Date | null;
  revokedAt: Date | null;
  notificationsAllowed: boolean;
  emailNotificationsEnabled: boolean;
  smsNotificationsEnabled: boolean;
  notificationPreferencesJson: JsonValue;
  createdAt: Date;
  updatedAt: Date;
};

export type EventStaffFixture = {
  id: string;
  eventId: string;
  hackerId: string;
  role: EventStaffRole;
  createdAt: Date;
  updatedAt: Date;
};

export type UserBanFixture = {
  id: string;
  hackerId: string;
  publicSafeReason: string;
  internalNote: string | null;
  createdById: string;
  createdAt: Date;
  revokedById: string | null;
  revokedAt: Date | null;
  revocationReason: string | null;
};

export type UserBanFlagFixture = {
  id: string;
  chapterId: string;
  hackerId: string;
  createdById: string;
  reason: string;
  status: UserBanFlagStatus;
  resolutionNote: string | null;
  resolvedById: string | null;
  resolvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type HackerOrganizerNoteFixture = {
  id: string;
  hackerId: string;
  body: string;
  updatedById: string;
  createdAt: Date;
  updatedAt: Date;
};

export type HackerOrganizerNoteRevisionFixture = {
  id: string;
  noteId: string;
  hackerId: string;
  editedById: string;
  patchText: string;
  createdAt: Date;
};

export type ChapterRoleFixture = {
  chapter: ChapterFixture;
  hacker: HackerFixture;
  membership: ChapterMembershipFixture;
};

export type EventStaffRoleFixture = {
  hacker: HackerFixture;
  staff: EventStaffFixture;
};

const fixtureNow = () => new Date('2026-05-25T12:00:00.000Z');

export const buildHacker = (
  overrides: FixtureOverrides<HackerFixture> = {}
): HackerFixture => ({
  id: 'hacker-member',
  clerkId: 'clerk-member',
  name: 'Test Member',
  username: 'testmember',
  role: 'HACKER',
  bio: null,
  githubUrl: null,
  discordName: null,
  twitterUrl: null,
  linkedinUrl: null,
  websiteUrl: null,
  email: 'member@example.com',
  phoneNumber: null,
  attended: 0,
  avatarId: null,
  featuredProjectIds: [],
  totalMinutesAttended: 0,
  lastAttendance: null,
  createdAt: fixtureNow(),
  updatedAt: fixtureNow(),
  ...overrides,
});

export const buildSiteAdmin = (
  overrides: FixtureOverrides<HackerFixture> = {}
): HackerFixture =>
  buildHacker({
    id: 'hacker-site-admin',
    clerkId: 'clerk-site-admin',
    name: 'Site Admin',
    username: 'siteadmin',
    role: 'SITE_ADMIN',
    email: 'site-admin@example.com',
    ...overrides,
  });

export const buildChapter = (
  overrides: FixtureOverrides<ChapterFixture> = {}
): ChapterFixture => ({
  id: 'chapter-boston',
  name: 'Sundai Boston',
  slug: 'boston',
  city: 'Boston',
  region: 'MA',
  country: 'US',
  timezone: 'America/New_York',
  description: 'Boston chapter',
  status: 'ACTIVE',
  accessMode: 'PUBLIC',
  defaultDeclineMessage: null,
  mailingListName: null,
  mailingListExternalId: null,
  createdAt: fixtureNow(),
  updatedAt: fixtureNow(),
  ...overrides,
});

export const buildChapterMembership = (
  overrides: FixtureOverrides<ChapterMembershipFixture> = {}
): ChapterMembershipFixture => ({
  id: 'membership-member-boston',
  chapterId: 'chapter-boston',
  hackerId: 'hacker-member',
  role: 'MEMBER',
  status: 'ACTIVE',
  invitedById: null,
  invitedAt: null,
  joinedAt: fixtureNow(),
  leftAt: null,
  revokedAt: null,
  notificationsAllowed: true,
  emailNotificationsEnabled: true,
  smsNotificationsEnabled: false,
  notificationPreferencesJson: {},
  createdAt: fixtureNow(),
  updatedAt: fixtureNow(),
  ...overrides,
});

export const buildChapterAdminMembership = (
  overrides: FixtureOverrides<ChapterMembershipFixture> = {}
): ChapterMembershipFixture =>
  buildChapterMembership({
    id: 'membership-chapter-admin-boston',
    hackerId: 'hacker-chapter-admin',
    role: 'ADMIN',
    ...overrides,
  });

export const buildChapterAdminFixture = ({
  chapter: chapterOverrides,
  hacker: hackerOverrides,
  membership: membershipOverrides,
}: {
  chapter?: FixtureOverrides<ChapterFixture>;
  hacker?: FixtureOverrides<HackerFixture>;
  membership?: FixtureOverrides<ChapterMembershipFixture>;
} = {}): ChapterRoleFixture => {
  const chapter = buildChapter(chapterOverrides);
  const hacker = buildHacker({
    id: 'hacker-chapter-admin',
    clerkId: 'clerk-chapter-admin',
    name: 'Chapter Admin',
    username: 'chapteradmin',
    email: 'chapter-admin@example.com',
    ...hackerOverrides,
  });

  return {
    chapter,
    hacker,
    membership: buildChapterAdminMembership({
      chapterId: chapter.id,
      hackerId: hacker.id,
      ...membershipOverrides,
    }),
  };
};

export const buildChapterMemberFixture = ({
  chapter: chapterOverrides,
  hacker: hackerOverrides,
  membership: membershipOverrides,
}: {
  chapter?: FixtureOverrides<ChapterFixture>;
  hacker?: FixtureOverrides<HackerFixture>;
  membership?: FixtureOverrides<ChapterMembershipFixture>;
} = {}): ChapterRoleFixture => {
  const chapter = buildChapter(chapterOverrides);
  const hacker = buildHacker(hackerOverrides);

  return {
    chapter,
    hacker,
    membership: buildChapterMembership({
      chapterId: chapter.id,
      hackerId: hacker.id,
      ...membershipOverrides,
    }),
  };
};

export const buildEventStaff = (
  overrides: FixtureOverrides<EventStaffFixture> = {}
): EventStaffFixture => ({
  id: 'event-staff-mc',
  eventId: 'event-boston-demo-night',
  hackerId: 'hacker-event-mc',
  role: 'MC',
  createdAt: fixtureNow(),
  updatedAt: fixtureNow(),
  ...overrides,
});

export const buildEventStaffFixture = ({
  hacker: hackerOverrides,
  staff: staffOverrides,
}: {
  hacker?: FixtureOverrides<HackerFixture>;
  staff?: FixtureOverrides<EventStaffFixture>;
} = {}): EventStaffRoleFixture => {
  const hacker = buildHacker({
    id: 'hacker-event-mc',
    clerkId: 'clerk-event-mc',
    name: 'Event MC',
    username: 'eventmc',
    email: 'event-mc@example.com',
    ...hackerOverrides,
  });

  return {
    hacker,
    staff: buildEventStaff({
      hackerId: hacker.id,
      ...staffOverrides,
    }),
  };
};

export const buildCoMcFixture = (
  overrides: Parameters<typeof buildEventStaffFixture>[0] = {}
): EventStaffRoleFixture =>
  buildEventStaffFixture({
    hacker: {
      id: 'hacker-event-co-mc',
      clerkId: 'clerk-event-co-mc',
      name: 'Event Co-MC',
      username: 'eventcomc',
      email: 'event-co-mc@example.com',
      ...overrides.hacker,
    },
    staff: {
      id: 'event-staff-co-mc',
      role: 'CO_MC',
      ...overrides.staff,
    },
  });

export const buildUserBan = (
  overrides: FixtureOverrides<UserBanFixture> = {}
): UserBanFixture => ({
  id: 'user-ban-active',
  hackerId: 'hacker-banned',
  publicSafeReason: 'You are unable to register for this event at this time.',
  internalNote: 'Internal site-admin-only ban context',
  createdById: 'hacker-site-admin',
  createdAt: fixtureNow(),
  revokedById: null,
  revokedAt: null,
  revocationReason: null,
  ...overrides,
});

export const buildUserBanFlag = (
  overrides: FixtureOverrides<UserBanFlagFixture> = {}
): UserBanFlagFixture => ({
  id: 'user-ban-flag-open',
  chapterId: 'chapter-boston',
  hackerId: 'hacker-flagged',
  createdById: 'hacker-chapter-admin',
  reason: 'Chapter admin review request',
  status: 'OPEN',
  resolutionNote: null,
  resolvedById: null,
  resolvedAt: null,
  createdAt: fixtureNow(),
  updatedAt: fixtureNow(),
  ...overrides,
});

export const buildOrganizerNote = (
  overrides: FixtureOverrides<HackerOrganizerNoteFixture> = {}
): HackerOrganizerNoteFixture => ({
  id: 'organizer-note-current',
  hackerId: 'hacker-member',
  body: 'Helpful organizer context for this hacker.',
  updatedById: 'hacker-chapter-admin',
  createdAt: fixtureNow(),
  updatedAt: fixtureNow(),
  ...overrides,
});

export const buildOrganizerNoteRevision = (
  overrides: FixtureOverrides<HackerOrganizerNoteRevisionFixture> = {}
): HackerOrganizerNoteRevisionFixture => ({
  id: 'organizer-note-revision',
  noteId: 'organizer-note-current',
  hackerId: 'hacker-member',
  editedById: 'hacker-chapter-admin',
  patchText: 'Initial note body',
  createdAt: fixtureNow(),
  ...overrides,
});
