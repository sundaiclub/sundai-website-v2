import type { Prisma } from '@prisma/client';

export type JsonValue = Prisma.JsonValue;
export type JsonObject = Prisma.JsonObject;

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
export type EventStatus = 'DRAFT' | 'PUBLISHED' | 'PAUSED' | 'ARCHIVED';
export type EventVisibility = 'PUBLIC' | 'PRIVATE' | 'UNLISTED';
export type EventApplicationMode = 'REQUIRES_APPROVAL' | 'OPEN_RSVP';
export type PitchSessionPhase = 'VOTING' | 'PITCHING' | 'FINISHED';

export type ApplicationTemplateScope = 'SITE' | 'CHAPTER';

export type RegistrationStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'WAITLISTED'
  | 'DECLINED'
  | 'BLOCKED'
  | 'CANCELLED';

export type RegistrationSource = 'INTERNAL' | 'WEBSITE' | 'IMPORT';

export type PublicEventStatus =
  | 'OPEN'
  | 'CLOSED'
  | 'FULL'
  | 'WAITLIST_AVAILABLE'
  | 'ENDED';

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
  nextEvent?: ChapterLandingEvent | null;
  viewerMembership?: Pick<ChapterMembership, 'role' | 'status'> | null;
  memberships?: Array<Pick<ChapterMembership, 'role' | 'status'>>;
};

type ChapterLandingEvent = {
  id: EntityId;
  title: string;
  slug: string;
  startTime?: Date | string;
  publicLocation?: string | null;
  status?: EventStatus;
  visibility?: EventVisibility;
};

export type ChapterLanding = Pick<
  Chapter,
  | 'id'
  | 'name'
  | 'slug'
  | 'city'
  | 'region'
  | 'country'
  | 'timezone'
  | 'description'
  | 'accessMode'
  | 'status'
  | 'heroImage'
  | 'mailingListName'
  | 'mailingListExternalId'
> & {
  viewerMembership?: ChapterMembershipSummary | null;
  memberships?: ChapterMembershipSummary[];
  upcomingEvents?: ChapterLandingEvent[];
  pendingEvents?: ChapterLandingEvent[];
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

export interface ProfilePrefillSource {
  name?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  username?: string | null;
  bio?: string | null;
  githubUrl?: string | null;
  linkedinUrl?: string | null;
  twitterUrl?: string | null;
  websiteUrl?: string | null;
  discordName?: string | null;
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
  answersJson?: JsonValue | null;
  templateSnapshotJson?: JsonValue | null;
  publicSafeMessage?: string | null;
  internalReviewNotes?: string | null;
  decidedById?: EntityId | null;
  decidedAt?: ISODateTimeString | Date | null;
  submittedAt?: ISODateTimeString | Date;
  cancelledAt?: ISODateTimeString | Date | null;
  cancelledById?: EntityId | null;
  waitlistedAt?: ISODateTimeString | Date | null;
  createdAt: ISODateTimeString | Date;
  updatedAt: ISODateTimeString | Date;
  hacker?: EventManagementHackerSummary;
  decidedBy?: EventManagementHackerSummary | null;
  cancelledBy?: EventManagementHackerSummary | null;
}

export interface EventRegistrationAudit {
  id: EntityId;
  registrationId: EntityId;
  eventId: EntityId;
  actorId: EntityId;
  fromStatus?: RegistrationStatus | null;
  toStatus: RegistrationStatus;
  changeJson?: JsonValue | null;
  createdAt: ISODateTimeString | Date;
  actor?: EventManagementHackerSummary;
}

export type OrganizerEventListItem = {
  id: EntityId;
  title: string;
  description?: string | null;
  startTime: ISODateTimeString | Date;
  endTime?: ISODateTimeString | Date | null;
  status?: EventStatus;
  visibility?: EventVisibility;
  publicStatus?: PublicEventStatus;
  applicationMode?: EventApplicationMode;
  applicationsOpen?: boolean;
  capacity?: number | null;
  _count?: {
    registrations?: number;
  };
  meetingUrl?: string | null;
  pitchSessions?: Array<{ phase: PitchSessionPhase }>;
  chapter?: Pick<Chapter, 'id' | 'name' | 'slug'>;
};

export type OrganizerEventSettings = {
  id: EntityId;
  title: string;
  slug?: string;
  status?: EventStatus;
  description?: string | null;
  publicLocation?: string | null;
  visibility?: EventVisibility;
  publicStatus?: PublicEventStatus;
  applicationMode?: EventApplicationMode;
  applicationsOpen?: boolean;
  applicationsClosedAt?: ISODateTimeString | Date | null;
  applicationsClosedById?: EntityId | null;
  applicationsCloseReason?: string | null;
  capacity?: number | null;
  approvedCount?: number;
  autoPromoteWaitlist?: boolean;
  approvedDetailsJson?: JsonObject | null;
  confirmationMessage?: string | null;
  waitlistMessage?: string | null;
  declineMessage?: string | null;
  chapter?: Pick<Chapter, 'id' | 'name' | 'slug' | 'timezone'>;
  staff?: Array<
    Pick<EventStaff, 'id' | 'role'> & {
      hacker?: Pick<EventManagementHackerSummary, 'id' | 'name'> | null;
    }
  >;
};

export interface PublicEventChapterSummary {
  id: EntityId;
  slug: string;
  name: string;
  timezone: string;
}

export interface PublicViewerRegistrationState {
  id: EntityId;
  status: RegistrationStatus;
  submittedAt?: ISODateTimeString | Date | null;
  cancelledAt?: ISODateTimeString | Date | null;
  publicSafeMessage?: string | null;
  canEditAnswers: boolean;
  canCancel: boolean;
  answersJson?: JsonObject | null;
}

export interface PublicEventCard {
  id: EntityId;
  slug: string;
  chapterSlug: string;
  chapterName: string;
  chapter: PublicEventChapterSummary;
  title: string;
  publicLocation?: string | null;
  startTime: ISODateTimeString | Date;
  endTime?: ISODateTimeString | Date | null;
  publicStatus: PublicEventStatus;
  viewerRegistrationStatus?: RegistrationStatus | null;
}

export interface AddToCalendarPayload {
  title: string;
  description?: string | null;
  location?: string | null;
  startTime: ISODateTimeString | Date;
  endTime?: ISODateTimeString | Date | null;
  timezone: string;
}

export interface ApplicationQuestionSet {
  siteFields: TemplateFieldDefinition[];
  chapterFields: TemplateFieldDefinition[];
  eventFields: TemplateFieldDefinition[];
  composedFields: TemplateFieldDefinition[];
  snapshotVersion?: string | number | null;
  siteTemplateId?: EntityId | null;
  chapterTemplateId?: EntityId | null;
  eventId?: EntityId | null;
}

export interface ApplicationControlsState {
  applicationMode: EventApplicationMode;
  applicationsOpen: boolean;
  applicationsClosedAt?: ISODateTimeString | Date | null;
  applicationsCloseReason?: string | null;
  capacity?: number | null;
  approvedCount?: number;
  autoPromoteWaitlist?: boolean;
  publicStatus: PublicEventStatus;
  canSubmit: boolean;
  canEditAnswers: boolean;
  canCancelRegistration: boolean;
  signInRequired: boolean;
  disabledReason?: string | null;
  publicMessage?: string | null;
}

export interface PublicEventDetail extends PublicEventCard {
  description?: string | null;
  publicProgramLabel?: string | null;
  publicSponsorText?: string | null;
  publicExpertText?: string | null;
  approvedDetailsJson?: JsonObject | null;
  approvedDetailsVisible: boolean;
  applicationControls: ApplicationControlsState;
  applicationQuestionSet: ApplicationQuestionSet;
  viewerRegistration?: PublicViewerRegistrationState | null;
  addToCalendar: AddToCalendarPayload;
}

export interface PublicEventDetailState {
  event: PublicEventDetail;
  viewerRegistration: PublicViewerRegistrationState | null;
  applicationControls: ApplicationControlsState;
  registrationForm: RegistrationFormState | null;
  approvedDetailsVisible: boolean;
  error?: string | null;
}

export type ApplicationFormMode = 'CREATE' | 'EDIT' | 'LOCKED';

export interface ApplicationFormFieldState {
  field: TemplateFieldDefinition;
  value?: JsonValue;
  error?: string | null;
  prefilled: boolean;
}

export interface RegistrationFormState {
  mode: ApplicationFormMode;
  fields: ApplicationFormFieldState[];
  answersJson: JsonObject;
  submittedAt?: ISODateTimeString | Date | null;
  lockedStatus?: RegistrationStatus | null;
  canSubmit: boolean;
  submitLabel: string;
}

export interface RegistrationFormSubmission {
  answersJson: JsonObject;
}

export interface RegistrationFormValidationError {
  fieldId: string;
  message: string;
}

export interface PublicRegistrationResponse {
  id: EntityId;
  status: RegistrationStatus;
  submittedAt: ISODateTimeString | Date;
  publicSafeMessage?: string | null;
}

export type OrganizerReviewRole =
  | 'SITE_ADMIN'
  | 'CHAPTER_ADMIN'
  | EventStaffRole;

export interface OrganizerRegistrationReviewCapabilities {
  canView: boolean;
  canDecide: boolean;
  canApprove: boolean;
  canWaitlist: boolean;
  canDecline: boolean;
  canCancel: boolean;
  canEditInternalNotes: boolean;
  canViewBanContext: boolean;
}

export interface OrganizerRegistrationReviewRow {
  id: EntityId;
  eventId: EntityId;
  hackerId: EntityId;
  status: RegistrationStatus;
  source: RegistrationSource;
  applicant: Pick<
    EventManagementHackerSummary,
    'id' | 'name' | 'username' | 'email' | 'role'
  >;
  answersJson?: JsonObject | null;
  templateSnapshotJson?: TemplateFieldDefinition[] | null;
  publicSafeMessage?: string | null;
  internalReviewNotes?: string | null;
  organizerNoteBody?: string | null;
  submittedAt?: ISODateTimeString | Date | null;
  decidedAt?: ISODateTimeString | Date | null;
  decidedBy?: Pick<EventManagementHackerSummary, 'id' | 'name'> | null;
  cancelledAt?: ISODateTimeString | Date | null;
  cancelledBy?: Pick<EventManagementHackerSummary, 'id' | 'name'> | null;
  activeBan?: {
    id: EntityId;
    publicSafeReason: string;
    createdAt: ISODateTimeString | Date;
  } | null;
  capabilities: OrganizerRegistrationReviewCapabilities;
}

export interface OrganizerRegistrationReviewState {
  eventId: EntityId;
  statusFilter?: Exclude<RegistrationStatus, 'BLOCKED'> | 'BLOCKED';
  includeBannedUsers: boolean;
  viewerRole: OrganizerReviewRole;
  rows: OrganizerRegistrationReviewRow[];
}

export interface ApplicationControlRequest {
  eventId: EntityId;
  reason?: string | null;
}

export interface ApplicationControlResponse {
  eventId: EntityId;
  applicationsOpen: boolean;
  applicationsClosedAt?: ISODateTimeString | Date | null;
  applicationsClosedById?: EntityId | null;
  applicationsCloseReason?: string | null;
}

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
