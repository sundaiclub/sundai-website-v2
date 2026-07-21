import type {
  BanFlagStatus,
  ChapterAccessMode,
  ChapterMembershipStatus,
  ChapterRole,
  ChapterStatus,
  EventApplicationMode as SharedEventApplicationMode,
  EventStaffRole,
  EventStatus as SharedEventStatus,
  EventVisibility as SharedEventVisibility,
  JsonObject,
  JsonValue,
  RegistrationSource,
  RegistrationStatus,
  Role,
} from '../../src/types/event-management';
import type {
  EventCommunicationAudience,
  EventCommunicationChannel,
  EventCommunicationRecipientStatus,
  EventCommunicationStatus,
  EventMaterialAuditAction,
  EventMaterialKind,
  EventMaterialVisibility,
  EventProjectCardStatus,
} from '../../src/types/event-workspace';

export type FixtureOverrides<T> = Partial<T>;

type EventManagementRole = Role;
type ChapterMembershipRole = ChapterRole;
type UserBanFlagStatus = BanFlagStatus;
export type EventStatus = SharedEventStatus;
export type EventVisibility = SharedEventVisibility;
export type EventApplicationMode = SharedEventApplicationMode;
export type EventRegistrationStatus = RegistrationStatus;
export type EventRegistrationSource = RegistrationSource;

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
  heroImageId: string | null;
  status: ChapterStatus;
  accessMode: ChapterAccessMode;
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
  smsConsentAt: Date | null;
  smsConsentVersion: string | null;
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

export type EventStaffAuditFixture = {
  id: string;
  eventId: string;
  staffHackerId: string;
  actorId: string;
  action: 'ASSIGNED' | 'ROLE_CHANGED' | 'REMOVED';
  fromRole: EventStaffRole | null;
  toRole: EventStaffRole | null;
  createdAt: Date;
};

export type EventMaterialFixture = {
  id: string;
  eventId: string;
  kind: EventMaterialKind;
  visibility: EventMaterialVisibility;
  title: string;
  description: string | null;
  externalUrl: string | null;
  objectKey: string | null;
  bucket: string | null;
  originalFilename: string | null;
  mimeType: string | null;
  size: number | null;
  position: number;
  isAvailable: boolean;
  availableFrom: Date | null;
  availableUntil: Date | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
};

export type EventMaterialAuditFixture = {
  id: string;
  eventId: string;
  materialId: string | null;
  actorId: string;
  action: EventMaterialAuditAction;
  changeJson: JsonValue;
  createdAt: Date;
};

export type EventCommunicationFixture = {
  id: string;
  eventId: string;
  createdById: string;
  sentById: string | null;
  channel: EventCommunicationChannel;
  status: EventCommunicationStatus;
  subject: string | null;
  body: string;
  audienceType: EventCommunicationAudience;
  audienceDefinitionJson: JsonValue;
  previewFingerprint: string | null;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  sentAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type EventCommunicationRecipientFixture = {
  id: string;
  communicationId: string;
  hackerId: string;
  registrationId: string;
  contactValue: string;
  displayName: string;
  status: EventCommunicationRecipientStatus;
  providerMessageId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  attemptedAt: Date | null;
  deliveredAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type PitchProjectFixture = {
  id: string;
  pitchSessionId: string;
  projectId: string;
  addedById: string;
  position: number;
  status: 'QUEUED' | 'APPROVED' | 'CURRENT' | 'DONE' | 'SKIPPED';
  cardStatus: EventProjectCardStatus;
  approved: boolean;
  isTopProject: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type EventFixture = {
  id: string;
  title: string;
  description: string | null;
  startTime: Date;
  endTime: Date | null;
  meetingUrl: string | null;
  location: string | null;
  venueName: string | null;
  publicLocation: string | null;
  address: string | null;
  virtualUrl: string | null;
  createdById: string;
  chapterId: string;
  slug: string;
  slugNeedsCleanup: boolean;
  status: EventStatus;
  visibility: EventVisibility;
  programType: string | null;
  publicProgramLabel: string | null;
  capacity: number | null;
  applicationMode: EventApplicationMode;
  autoPromoteWaitlist: boolean;
  approvedDetailsJson: JsonObject | null;
  applicationQuestionsJson: JsonValue;
  hideChapterDefaultQuestions: boolean;
  applicationsOpen: boolean;
  applicationsClosedAt: Date | null;
  applicationsClosedById: string | null;
  applicationsCloseReason: string | null;
  checkInOpensAt: Date | null;
  checkInClosesAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type EventRegistrationFixture = {
  id: string;
  eventId: string;
  hackerId: string;
  status: EventRegistrationStatus;
  source: EventRegistrationSource;
  answersJson: JsonObject | null;
  templateSnapshotJson: JsonValue;
  publicSafeMessage: string | null;
  internalReviewNotes: string | null;
  decidedById: string | null;
  decidedAt: Date | null;
  submittedAt: Date;
  cancelledAt: Date | null;
  cancelledById: string | null;
  waitlistedAt: Date | null;
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

export type BannedApplicantFixture = {
  hacker: HackerFixture;
  ban: UserBanFixture;
};

export type NativeEventRsvpFixture = {
  publicChapter: ChapterFixture;
  privateChapter: ChapterFixture;
  publishedEvent: EventFixture;
  unpublishedEvent: EventFixture;
  privateChapterEvent: EventFixture;
  applicant: HackerFixture;
  approvedApplicant: HackerFixture;
  waitlistedApplicant: HackerFixture;
  bannedApplicant: HackerFixture;
  ban: UserBanFixture;
  mc: EventStaffRoleFixture;
  coMc: EventStaffRoleFixture;
  pendingRegistration: EventRegistrationFixture;
  approvedRegistration: EventRegistrationFixture;
  waitlistedRegistration: EventRegistrationFixture;
  blockedRegistration: EventRegistrationFixture;
};

const fixtureNow = () => new Date('2026-05-25T12:00:00.000Z');

const fixtureSubmittedAt = () => new Date('2026-06-22T16:00:00.000Z');

export const buildApprovedOnlyDetails = (
  overrides: FixtureOverrides<JsonObject> = {}
): JsonObject => ({
  address: '123 Builder Lane, Boston, MA 02110',
  arrivalInstructions: 'Use the side entrance and check in with Sundai staff.',
  virtualUrl: 'https://example.com/events/boston-ai-build-night/stream',
  onsiteContact: 'Sundai event team',
  ...overrides,
});

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
  heroImageId: null,
  status: 'ACTIVE',
  accessMode: 'PUBLIC',
  mailingListName: null,
  mailingListExternalId: null,
  createdAt: fixtureNow(),
  updatedAt: fixtureNow(),
  ...overrides,
});

export const buildPublicChapter = (
  overrides: FixtureOverrides<ChapterFixture> = {}
): ChapterFixture =>
  buildChapter({
    status: 'ACTIVE',
    accessMode: 'PUBLIC',
    ...overrides,
  });

export const buildPrivateChapter = (
  overrides: FixtureOverrides<ChapterFixture> = {}
): ChapterFixture =>
  buildChapter({
    id: 'chapter-cambridge-private',
    name: 'Sundai Cambridge',
    slug: 'cambridge',
    city: 'Cambridge',
    description: 'Private Cambridge chapter',
    accessMode: 'PRIVATE',
    mailingListName: 'Cambridge builders',
    mailingListExternalId: 'list-cambridge-builders',
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
  smsConsentAt: null,
  smsConsentVersion: null,
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

export const buildEvent = (
  overrides: FixtureOverrides<EventFixture> = {}
): EventFixture => ({
  id: 'event-boston-ai-build-night',
  title: 'AI Build Night',
  description: 'Public event description for Boston builders.',
  startTime: new Date('2026-07-10T22:00:00.000Z'),
  endTime: new Date('2026-07-11T01:00:00.000Z'),
  meetingUrl: null,
  location: null,
  venueName: 'Sundai Boston HQ',
  publicLocation: 'Boston, MA',
  address: '123 Builder Lane, Boston, MA 02110',
  virtualUrl: 'https://example.com/events/boston-ai-build-night/stream',
  createdById: 'hacker-chapter-admin',
  chapterId: 'chapter-boston',
  slug: 'ai-build-night',
  slugNeedsCleanup: false,
  status: 'PUBLISHED',
  visibility: 'PUBLIC',
  programType: 'BUILD_NIGHT',
  publicProgramLabel: 'AI Build Night',
  capacity: 40,
  applicationMode: 'REQUIRES_APPROVAL',
  autoPromoteWaitlist: false,
  approvedDetailsJson: buildApprovedOnlyDetails(),
  applicationQuestionsJson: [
    {
      id: 'why_this_event',
      label: 'Why do you want to join this event?',
      type: 'TEXTAREA',
      required: true,
      order: 10,
    },
    {
      id: 'project_url',
      label: 'Project URL',
      type: 'URL',
      required: false,
      order: 20,
    },
  ],
  hideChapterDefaultQuestions: false,
  applicationsOpen: true,
  applicationsClosedAt: null,
  applicationsClosedById: null,
  applicationsCloseReason: null,
  checkInOpensAt: null,
  checkInClosesAt: null,
  createdAt: fixtureNow(),
  updatedAt: fixtureNow(),
  ...overrides,
});

export const buildPublishedEvent = (
  overrides: FixtureOverrides<EventFixture> = {}
): EventFixture =>
  buildEvent({
    status: 'PUBLISHED',
    visibility: 'PUBLIC',
    ...overrides,
  });

export const buildUnpublishedEvent = (
  overrides: FixtureOverrides<EventFixture> = {}
): EventFixture =>
  buildEvent({
    id: 'event-boston-unpublished-demo-night',
    title: 'Unpublished Demo Night',
    slug: 'unpublished-demo-night',
    status: 'DRAFT',
    ...overrides,
  });

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

export const buildEventStaffAudit = (
  overrides: FixtureOverrides<EventStaffAuditFixture> = {}
): EventStaffAuditFixture => ({
  id: 'event-staff-audit-assigned',
  eventId: 'event-boston-ai-build-night',
  staffHackerId: 'hacker-event-mc',
  actorId: 'hacker-chapter-admin',
  action: 'ASSIGNED',
  fromRole: null,
  toRole: 'MC',
  createdAt: fixtureNow(),
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

export const buildMcFixture = (
  overrides: Parameters<typeof buildEventStaffFixture>[0] = {}
): EventStaffRoleFixture => buildEventStaffFixture(overrides);

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

export const buildSignedInApplicant = (
  overrides: FixtureOverrides<HackerFixture> = {}
): HackerFixture =>
  buildHacker({
    id: 'hacker-applicant',
    clerkId: 'clerk-applicant',
    name: 'Signed In Applicant',
    username: 'signedinapplicant',
    email: 'applicant@example.com',
    role: 'HACKER',
    ...overrides,
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

export const buildBannedApplicantFixture = ({
  hacker: hackerOverrides,
  ban: banOverrides,
}: {
  hacker?: FixtureOverrides<HackerFixture>;
  ban?: FixtureOverrides<UserBanFixture>;
} = {}): BannedApplicantFixture => {
  const hacker = buildSignedInApplicant({
    id: 'hacker-banned-applicant',
    clerkId: 'clerk-banned-applicant',
    name: 'Banned Applicant',
    username: 'bannedapplicant',
    email: 'banned-applicant@example.com',
    ...hackerOverrides,
  });

  return {
    hacker,
    ban: buildUserBan({
      hackerId: hacker.id,
      ...banOverrides,
    }),
  };
};

export const buildEventRegistration = (
  overrides: FixtureOverrides<EventRegistrationFixture> = {}
): EventRegistrationFixture => ({
  id: 'registration-applicant-pending',
  eventId: 'event-boston-ai-build-night',
  hackerId: 'hacker-applicant',
  status: 'PENDING',
  source: 'WEBSITE',
  answersJson: {
    name: 'Signed In Applicant',
    email: 'applicant@example.com',
    why_this_event: 'I want to build with the Boston AI community.',
    project_url: 'https://example.com/applicant-project',
  },
  templateSnapshotJson: [
    {
      id: 'name',
      label: 'Name',
      type: 'TEXT',
      required: true,
      siteRequired: true,
      order: 1,
    },
    {
      id: 'email',
      label: 'Email',
      type: 'EMAIL',
      required: true,
      siteRequired: true,
      order: 2,
    },
    {
      id: 'why_this_event',
      label: 'Why do you want to join this event?',
      type: 'TEXTAREA',
      required: true,
      order: 10,
    },
  ],
  publicSafeMessage: null,
  internalReviewNotes: null,
  decidedById: null,
  decidedAt: null,
  submittedAt: fixtureSubmittedAt(),
  cancelledAt: null,
  cancelledById: null,
  waitlistedAt: null,
  createdAt: fixtureSubmittedAt(),
  updatedAt: fixtureSubmittedAt(),
  ...overrides,
});

export const buildApprovedRegistration = (
  overrides: FixtureOverrides<EventRegistrationFixture> = {}
): EventRegistrationFixture =>
  buildEventRegistration({
    id: 'registration-applicant-approved',
    status: 'APPROVED',
    publicSafeMessage: 'You are approved.',
    decidedById: 'hacker-event-mc',
    decidedAt: new Date('2026-06-22T18:00:00.000Z'),
    updatedAt: new Date('2026-06-22T18:00:00.000Z'),
    ...overrides,
  });

export const buildWaitlistedRegistration = (
  overrides: FixtureOverrides<EventRegistrationFixture> = {}
): EventRegistrationFixture =>
  buildEventRegistration({
    id: 'registration-applicant-waitlisted',
    status: 'WAITLISTED',
    publicSafeMessage: 'You are on the waitlist.',
    decidedById: 'hacker-event-mc',
    decidedAt: new Date('2026-06-22T18:15:00.000Z'),
    waitlistedAt: new Date('2026-06-22T18:15:00.000Z'),
    updatedAt: new Date('2026-06-22T18:15:00.000Z'),
    ...overrides,
  });

export const buildBlockedRegistration = (
  overrides: FixtureOverrides<EventRegistrationFixture> = {}
): EventRegistrationFixture =>
  buildEventRegistration({
    id: 'registration-banned-applicant-blocked',
    hackerId: 'hacker-banned-applicant',
    status: 'BLOCKED',
    publicSafeMessage: 'You are unable to register for this event at this time.',
    answersJson: null,
    templateSnapshotJson: null,
    internalReviewNotes: 'Active global ban; visible to site admins only.',
    ...overrides,
  });

export const buildNativeEventRsvpFixture = (): NativeEventRsvpFixture => {
  const publicChapter = buildPublicChapter();
  const privateChapter = buildPrivateChapter();
  const publishedEvent = buildPublishedEvent({
    chapterId: publicChapter.id,
  });
  const unpublishedEvent = buildUnpublishedEvent({
    chapterId: publicChapter.id,
  });
  const privateChapterEvent = buildPublishedEvent({
    id: 'event-cambridge-private-ai-salon',
    chapterId: privateChapter.id,
    title: 'Private AI Salon',
    slug: 'private-ai-salon',
    publicLocation: 'Cambridge, MA',
  });
  const applicant = buildSignedInApplicant();
  const approvedApplicant = buildSignedInApplicant({
    id: 'hacker-approved-applicant',
    clerkId: 'clerk-approved-applicant',
    name: 'Approved Applicant',
    username: 'approvedapplicant',
    email: 'approved-applicant@example.com',
  });
  const waitlistedApplicant = buildSignedInApplicant({
    id: 'hacker-waitlisted-applicant',
    clerkId: 'clerk-waitlisted-applicant',
    name: 'Waitlisted Applicant',
    username: 'waitlistedapplicant',
    email: 'waitlisted-applicant@example.com',
  });
  const banned = buildBannedApplicantFixture();
  const mc = buildMcFixture({
    staff: { eventId: publishedEvent.id },
  });
  const coMc = buildCoMcFixture({
    staff: { eventId: publishedEvent.id },
  });

  return {
    publicChapter,
    privateChapter,
    publishedEvent,
    unpublishedEvent,
    privateChapterEvent,
    applicant,
    approvedApplicant,
    waitlistedApplicant,
    bannedApplicant: banned.hacker,
    ban: banned.ban,
    mc,
    coMc,
    pendingRegistration: buildEventRegistration({
      eventId: publishedEvent.id,
      hackerId: applicant.id,
    }),
    approvedRegistration: buildApprovedRegistration({
      id: 'registration-applicant-approved',
      eventId: publishedEvent.id,
      hackerId: approvedApplicant.id,
    }),
    waitlistedRegistration: buildWaitlistedRegistration({
      id: 'registration-applicant-waitlisted',
      eventId: publishedEvent.id,
      hackerId: waitlistedApplicant.id,
    }),
    blockedRegistration: buildBlockedRegistration({
      eventId: publishedEvent.id,
      hackerId: banned.hacker.id,
    }),
  };
};

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

export const buildEventMaterial = (
  overrides: FixtureOverrides<EventMaterialFixture> = {}
): EventMaterialFixture => ({
  id: 'event-material-sponsor-brief',
  eventId: 'event-boston-ai-build-night',
  kind: 'FILE',
  visibility: 'ORGANIZERS_ONLY',
  title: 'Sponsor brief',
  description: 'Private organizer reference material.',
  externalUrl: null,
  objectKey: 'events/event-boston-ai-build-night/materials/material-object-1',
  bucket: 'sundai-private-event-materials',
  originalFilename: 'sponsor-brief.pdf',
  mimeType: 'application/pdf',
  size: 481230,
  position: 10,
  isAvailable: true,
  availableFrom: null,
  availableUntil: null,
  createdById: 'hacker-event-mc',
  createdAt: fixtureNow(),
  updatedAt: fixtureNow(),
  ...overrides,
});

export const buildLinkEventMaterial = (
  overrides: FixtureOverrides<EventMaterialFixture> = {}
): EventMaterialFixture =>
  buildEventMaterial({
    id: 'event-material-brainstorming-board',
    kind: 'LINK',
    visibility: 'APPROVED_ATTENDEES',
    title: 'Brainstorming board',
    description: null,
    externalUrl: 'https://example.com/board',
    objectKey: null,
    bucket: null,
    originalFilename: null,
    mimeType: null,
    size: null,
    ...overrides,
  });

export const buildEventMaterialAudit = (
  overrides: FixtureOverrides<EventMaterialAuditFixture> = {}
): EventMaterialAuditFixture => ({
  id: 'event-material-audit-created',
  eventId: 'event-boston-ai-build-night',
  materialId: 'event-material-sponsor-brief',
  actorId: 'hacker-event-mc',
  action: 'CREATED',
  changeJson: {
    title: 'Sponsor brief',
    visibility: 'ORGANIZERS_ONLY',
  },
  createdAt: fixtureNow(),
  ...overrides,
});

export const buildEventCommunication = (
  overrides: FixtureOverrides<EventCommunicationFixture> = {}
): EventCommunicationFixture => ({
  id: 'event-communication-approved-email',
  eventId: 'event-boston-ai-build-night',
  createdById: 'hacker-event-mc',
  sentById: null,
  channel: 'EMAIL',
  status: 'DRAFT',
  subject: "Tomorrow's build night",
  body: 'Doors open at 9:30.',
  audienceType: 'APPROVED',
  audienceDefinitionJson: {},
  previewFingerprint: null,
  recipientCount: 0,
  sentCount: 0,
  failedCount: 0,
  sentAt: null,
  createdAt: fixtureNow(),
  updatedAt: fixtureNow(),
  ...overrides,
});

export const buildEventCommunicationRecipient = (
  overrides: FixtureOverrides<EventCommunicationRecipientFixture> = {}
): EventCommunicationRecipientFixture => ({
  id: 'event-communication-recipient-approved',
  communicationId: 'event-communication-approved-email',
  hackerId: 'hacker-approved-applicant',
  registrationId: 'registration-applicant-approved',
  contactValue: 'approved-applicant@example.com',
  displayName: 'Approved Applicant',
  status: 'PENDING',
  providerMessageId: null,
  errorCode: null,
  errorMessage: null,
  attemptedAt: null,
  deliveredAt: null,
  createdAt: fixtureNow(),
  updatedAt: fixtureNow(),
  ...overrides,
});

export const buildPitchProject = (
  overrides: FixtureOverrides<PitchProjectFixture> = {}
): PitchProjectFixture => ({
  id: 'pitch-project-event-entry',
  pitchSessionId: 'pitch-session-boston-ai-build-night',
  projectId: 'project-ai-demo',
  addedById: 'hacker-member',
  position: 1,
  status: 'QUEUED',
  cardStatus: 'DRAFT',
  approved: false,
  isTopProject: false,
  createdAt: fixtureNow(),
  updatedAt: fixtureNow(),
  ...overrides,
});
