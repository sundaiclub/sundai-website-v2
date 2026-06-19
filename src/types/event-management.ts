type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];

export interface JsonObject {
  [key: string]: JsonValue;
}

export type EntityId = string;
type ISODateTimeString = string;

export type Role =
  | 'NOT_SET'
  | 'NEWBIE'
  | 'HACKER'
  | 'SPONSOR'
  | 'LEADER'
  | 'SITE_ADMIN';

export type ChapterStatus = 'ACTIVE' | 'PAUSED' | 'ARCHIVED';
export type ChapterAccessMode = 'PUBLIC' | 'PRIVATE';
export type ChapterRole = 'MEMBER' | 'ADMIN';
export type ChapterMembershipStatus = 'INVITED' | 'ACTIVE' | 'REVOKED' | 'LEFT';

export type EventStaffRole = 'MC' | 'CO_MC';
type EventVisibility = 'PUBLIC' | 'PRIVATE' | 'UNLISTED';
type EventApplicationMode = 'NONE' | 'INTERNAL' | 'PUBLIC_LATER';
export type PitchSessionPhase = 'VOTING' | 'PITCHING' | 'FINISHED';

export type ApplicationTemplateScope = 'SITE' | 'CHAPTER';

export type RegistrationStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'WAITLISTED'
  | 'DECLINED'
  | 'BLOCKED'
  | 'CANCELLED';

export type RegistrationSource = 'INTERNAL' | 'PUBLIC_LATER' | 'IMPORT';

export type BanFlagStatus =
  | 'OPEN'
  | 'REVIEWING'
  | 'RESOLVED_NO_ACTION'
  | 'RESOLVED_BANNED'
  | 'DISMISSED';

export type PitchProjectStatus =
  | 'QUEUED'
  | 'APPROVED'
  | 'CURRENT'
  | 'DONE'
  | 'SKIPPED';

export type PitchProjectVoteValue = 'LIKE' | 'DISLIKE';

export type PitchPhase = 'WAITING' | 'PRESENTING' | 'QUESTIONS' | 'COMPLETED';

interface EventManagementHackerSummary {
  id: EntityId;
  name: string;
  username?: string | null;
  email?: string | null;
  role?: Role | null;
}

interface EventManagementImageSummary {
  id: EntityId;
  url: string;
  alt?: string | null;
  filename?: string | null;
}

export interface Chapter {
  id: EntityId;
  name: string;
  slug: string;
  city: string;
  region?: string | null;
  country: string;
  timezone: string;
  description?: string | null;
  heroImageId?: EntityId | null;
  heroImage?: EventManagementImageSummary | null;
  status: ChapterStatus;
  accessMode: ChapterAccessMode;
  mailingListName?: string | null;
  mailingListExternalId?: string | null;
  createdAt: ISODateTimeString | Date;
  updatedAt: ISODateTimeString | Date;
}

export type ChapterMembershipSummary = Pick<
  ChapterMembership,
  | 'id'
  | 'role'
  | 'status'
  | 'notificationsAllowed'
  | 'emailNotificationsEnabled'
  | 'smsNotificationsEnabled'
> & {
  hacker?: Pick<EventManagementHackerSummary, 'id' | 'name' | 'email' | 'role'>;
  invitedBy?: Pick<
    EventManagementHackerSummary,
    'id' | 'name' | 'email'
  > | null;
};

export type ChapterDirectoryItem = Pick<
  Chapter,
  | 'id'
  | 'name'
  | 'slug'
  | 'city'
  | 'region'
  | 'country'
  | 'timezone'
  | 'description'
  | 'heroImage'
  | 'accessMode'
  | 'status'
> & {
  viewerMembership?: Pick<ChapterMembership, 'role' | 'status'> | null;
  memberships?: Array<Pick<ChapterMembership, 'role' | 'status'>>;
};

type ChapterLandingEvent = {
  id: EntityId;
  title: string;
  publicLocation?: string | null;
};

export type ChapterLanding = Pick<
  Chapter,
  'id' | 'name' | 'slug' | 'city' | 'description' | 'accessMode' | 'heroImage'
> & {
  viewerMembership?: ChapterMembershipSummary | null;
  memberships?: ChapterMembershipSummary[];
  upcomingEvents?: ChapterLandingEvent[];
};

export type SiteAdminChapterListItem = Pick<
  Chapter,
  | 'id'
  | 'name'
  | 'slug'
  | 'city'
  | 'region'
  | 'country'
  | 'timezone'
  | 'status'
  | 'accessMode'
  | 'description'
  | 'heroImage'
>;

export type ManageableChapterListItem = Pick<
  Chapter,
  | 'id'
  | 'name'
  | 'slug'
  | 'city'
  | 'region'
  | 'timezone'
  | 'status'
  | 'accessMode'
  | 'heroImage'
> & {
  viewerMembership?: Pick<ChapterMembership, 'role' | 'status'> | null;
  memberships?: Array<Pick<ChapterMembership, 'role' | 'status'>>;
};

export interface ChapterMembership {
  id: EntityId;
  chapterId: EntityId;
  hackerId: EntityId;
  role: ChapterRole;
  status: ChapterMembershipStatus;
  invitedById?: EntityId | null;
  invitedAt?: ISODateTimeString | Date | null;
  joinedAt?: ISODateTimeString | Date | null;
  leftAt?: ISODateTimeString | Date | null;
  revokedAt?: ISODateTimeString | Date | null;
  notificationsAllowed: boolean;
  emailNotificationsEnabled: boolean;
  smsNotificationsEnabled: boolean;
  notificationPreferencesJson?: JsonObject | null;
  createdAt: ISODateTimeString | Date;
  updatedAt: ISODateTimeString | Date;
  hacker?: EventManagementHackerSummary;
  chapter?: Pick<Chapter, 'id' | 'name' | 'slug' | 'accessMode' | 'status'>;
}

interface EventStaff {
  id: EntityId;
  eventId: EntityId;
  hackerId: EntityId;
  role: EventStaffRole;
  createdAt: ISODateTimeString | Date;
  updatedAt: ISODateTimeString | Date;
  hacker?: EventManagementHackerSummary;
}

export type TemplateFieldType =
  | 'TEXT'
  | 'TEXTAREA'
  | 'EMAIL'
  | 'PHONE'
  | 'URL'
  | 'NUMBER'
  | 'BOOLEAN'
  | 'SELECT'
  | 'MULTI_SELECT'
  | 'DATE'
  | 'DATETIME';

export interface TemplateFieldOption {
  label: string;
  value: string;
}

export interface TemplateFieldValidation {
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
}

export interface TemplateFieldDefinition {
  id: string;
  label: string;
  type: TemplateFieldType;
  required: boolean;
  siteRequired?: boolean;
  helpText?: string | null;
  placeholder?: string | null;
  options?: TemplateFieldOption[];
  validation?: TemplateFieldValidation;
  order?: number;
}

interface ApplicationTemplate {
  id: EntityId;
  scope: ApplicationTemplateScope;
  chapterId?: EntityId | null;
  name: string;
  fieldsJson: TemplateFieldDefinition[];
  isActive: boolean;
  createdById: EntityId;
  createdAt: ISODateTimeString | Date;
  updatedAt: ISODateTimeString | Date;
  chapter?: Pick<Chapter, 'id' | 'name' | 'slug'> | null;
  createdBy?: EventManagementHackerSummary;
}

export type ApplicationTemplateListItem = Pick<
  ApplicationTemplate,
  'id' | 'name' | 'scope' | 'chapterId' | 'isActive'
> & {
  fields?: Array<Partial<TemplateFieldDefinition> & { key?: string }>;
  fieldsJson?: TemplateFieldDefinition[];
  chapter?: Pick<Chapter, 'id' | 'name' | 'slug'> | null;
};

export interface MergedApplicationTemplate {
  siteTemplateId: EntityId;
  chapterTemplateId?: EntityId | null;
  eventId?: EntityId | null;
  fields: TemplateFieldDefinition[];
}

export interface EventRegistration {
  id: EntityId;
  eventId: EntityId;
  hackerId: EntityId;
  status: RegistrationStatus;
  source: RegistrationSource;
  answersJson?: JsonObject | null;
  templateSnapshotJson?: TemplateFieldDefinition[] | null;
  publicSafeMessage?: string | null;
  internalReviewNotes?: string | null;
  decidedById?: EntityId | null;
  decidedAt?: ISODateTimeString | Date | null;
  createdAt: ISODateTimeString | Date;
  updatedAt: ISODateTimeString | Date;
  hacker?: EventManagementHackerSummary;
  decidedBy?: EventManagementHackerSummary | null;
}

export interface EventRegistrationAudit {
  id: EntityId;
  registrationId: EntityId;
  eventId: EntityId;
  actorId: EntityId;
  fromStatus?: RegistrationStatus | null;
  toStatus: RegistrationStatus;
  changeJson?: JsonObject | null;
  createdAt: ISODateTimeString | Date;
  actor?: EventManagementHackerSummary;
}

export type OrganizerEventListItem = {
  id: EntityId;
  title: string;
  description?: string | null;
  startTime: ISODateTimeString | Date;
  endTime?: ISODateTimeString | Date | null;
  meetingUrl?: string | null;
  pitchSessions?: Array<{ phase: PitchSessionPhase }>;
  chapter?: Pick<Chapter, 'id' | 'name' | 'slug'>;
};

export type OrganizerEventSettings = {
  id: EntityId;
  title: string;
  visibility?: EventVisibility;
  applicationMode?: EventApplicationMode;
  staff?: Array<
    Pick<EventStaff, 'id' | 'role'> & {
      hacker?: Pick<EventManagementHackerSummary, 'id' | 'name'> | null;
    }
  >;
};

export interface UserBan {
  id: EntityId;
  hackerId: EntityId;
  publicSafeReason: string;
  internalNote?: string | null;
  createdById: EntityId;
  createdAt: ISODateTimeString | Date;
  revokedById?: EntityId | null;
  revokedAt?: ISODateTimeString | Date | null;
  revocationReason?: string | null;
  hacker?: EventManagementHackerSummary;
  createdBy?: EventManagementHackerSummary;
  revokedBy?: EventManagementHackerSummary | null;
}

export type AdminBanListItem = UserBan & {
  hackerName?: string;
  publicReason?: string;
};

export interface UserBanFlag {
  id: EntityId;
  chapterId: EntityId;
  hackerId: EntityId;
  createdById: EntityId;
  reason: string;
  status: BanFlagStatus;
  resolutionNote?: string | null;
  resolvedById?: EntityId | null;
  resolvedAt?: ISODateTimeString | Date | null;
  createdAt: ISODateTimeString | Date;
  updatedAt: ISODateTimeString | Date;
  chapter?: Pick<Chapter, 'id' | 'name' | 'slug'>;
  hacker?: EventManagementHackerSummary;
  createdBy?: EventManagementHackerSummary;
  resolvedBy?: EventManagementHackerSummary | null;
}

export type AdminBanFlagListItem = UserBanFlag & {
  hackerName?: string;
};

export type OrganizerChapterSettings = Pick<
  Chapter,
  'id' | 'name' | 'slug' | 'description' | 'status' | 'accessMode' | 'heroImage'
>;

export interface HackerOrganizerNote {
  id: EntityId;
  hackerId: EntityId;
  body: string;
  updatedById: EntityId;
  createdAt: ISODateTimeString | Date;
  updatedAt: ISODateTimeString | Date;
  hacker?: EventManagementHackerSummary;
  updatedBy?: EventManagementHackerSummary;
}

export interface HackerOrganizerNoteRevision {
  id: EntityId;
  noteId: EntityId;
  hackerId: EntityId;
  editedById: EntityId;
  patchText: string;
  createdAt: ISODateTimeString | Date;
  editedBy?: EventManagementHackerSummary;
}
