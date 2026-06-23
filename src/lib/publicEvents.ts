import prisma from '@/lib/prisma';
import { canViewApprovedOnlyEventDetailsWithContext } from '@/lib/eventManagementAuth';
import {
  buildApplicationControlsState,
  getApplicationPublicStatus,
  parseTemplateFieldsJson,
} from '@/lib/applicationTemplates';
import type {
  AddToCalendarPayload,
  ApplicationControlsState,
  ApplicationQuestionSet,
  EntityId,
  EventApplicationMode,
  EventStaffRole,
  JsonObject,
  JsonValue,
  PublicEventCard,
  PublicEventDetail,
  PublicEventStatus,
  PublicViewerRegistrationState,
  RegistrationStatus,
  Role,
  TemplateFieldDefinition,
} from '@/types/event-management';

type LooseArgs = Record<string, unknown>;
type PublicEventsDelegate<TRecord> = {
  findMany(args?: LooseArgs): Promise<TRecord[]>;
  findFirst(args?: LooseArgs): Promise<TRecord | null>;
};

type PublicEventsHackerRecord = {
  id: EntityId;
  role?: Role | null;
};

type PublicEventsChapterMembershipRecord = {
  id?: EntityId;
  role: 'MEMBER' | 'ADMIN';
  status: 'INVITED' | 'ACTIVE' | 'REVOKED' | 'LEFT';
};

type PublicEventsStaffRecord = {
  id?: EntityId;
  role: EventStaffRole;
};

type PublicEventsChapterRecord = {
  id: EntityId;
  slug: string;
  name: string;
  timezone: string;
  status?: string | null;
  accessMode?: string | null;
};

type PublicEventsRegistrationRecord = {
  id: EntityId;
  eventId: EntityId;
  hackerId: EntityId;
  status: RegistrationStatus;
  answersJson?: JsonValue | null;
  publicSafeMessage?: string | null;
  submittedAt?: Date | string | null;
  cancelledAt?: Date | string | null;
};

type PublicEventsEventRecord = {
  id: EntityId;
  slug: string;
  title: string;
  description?: string | null;
  startTime: Date | string;
  endTime?: Date | string | null;
  publicLocation?: string | null;
  status?: string | null;
  visibility?: string | null;
  publicProgramLabel?: string | null;
  programType?: string | null;
  capacity?: number | null;
  applicationMode: EventApplicationMode;
  applicationsOpen: boolean;
  applicationsClosedAt?: Date | string | null;
  applicationsCloseReason?: string | null;
  autoPromoteWaitlist?: boolean | null;
  approvedDetailsJson?: JsonValue | null;
  applicationQuestionsJson?: JsonValue | null;
  hideChapterDefaultQuestions?: boolean | null;
  chapterId: EntityId;
  chapter: PublicEventsChapterRecord;
  _count?: {
    registrations?: number;
  };
};

export type PublicEventsPrismaClient = {
  event: PublicEventsDelegate<PublicEventsEventRecord>;
  eventRegistration: PublicEventsDelegate<PublicEventsRegistrationRecord>;
  hacker: {
    findFirst(args?: LooseArgs): Promise<PublicEventsHackerRecord | null>;
    findUnique?(args?: LooseArgs): Promise<PublicEventsHackerRecord | null>;
  };
  chapterMembership: PublicEventsDelegate<PublicEventsChapterMembershipRecord>;
  eventStaff: PublicEventsDelegate<PublicEventsStaffRecord>;
};

export type PublicEventViewer = {
  hackerId?: EntityId | null;
};

export type ListPublicEventsOptions = {
  chapterSlug?: string | null;
  viewer?: PublicEventViewer | null;
  now?: Date;
  take?: number;
  skip?: number;
  prismaClient?: PublicEventsPrismaClient;
};

export type GetPublicEventBySlugInput = {
  chapterSlug: string;
  eventSlug: string;
  viewer?: PublicEventViewer | null;
  now?: Date;
  includeApprovedCalendarDetails?: boolean;
  prismaClient?: PublicEventsPrismaClient;
};

export type RedactPublicEventOptions = {
  viewerRegistration?: PublicViewerRegistrationState | null;
  viewerCanManageRegistrations?: boolean;
  viewerCanViewApprovedDetails?: boolean;
  viewerIsSignedIn?: boolean;
  approvedCalendarDetails?: boolean;
  approvedCount?: number;
  now?: Date;
};

const defaultPrisma = prisma as unknown as PublicEventsPrismaClient;
const CANCELLABLE_REGISTRATION_STATUSES: readonly RegistrationStatus[] = [
  'PENDING',
  'APPROVED',
  'WAITLISTED',
];
const GENERIC_BLOCKED_MESSAGE =
  'You are unable to register for this event at this time.';

function publicEventVisibilityWhere(chapterSlug?: string | null): LooseArgs {
  return {
    status: 'PUBLISHED',
    visibility: 'PUBLIC',
    chapter: {
      status: 'ACTIVE',
      accessMode: 'PUBLIC',
      ...(chapterSlug ? { slug: chapterSlug } : {}),
    },
  };
}

function publicEventListingWhere(
  now: Date,
  chapterSlug?: string | null
): LooseArgs {
  return {
    ...publicEventVisibilityWhere(chapterSlug),
    startTime: { gte: now },
  };
}

function publicEventInclude(): LooseArgs {
  return {
    chapter: {
      select: {
        id: true,
        slug: true,
        name: true,
        timezone: true,
        status: true,
        accessMode: true,
      },
    },
    _count: {
      select: {
        registrations: {
          where: {
            status: 'APPROVED',
            cancelledAt: null,
          },
        },
      },
    },
  };
}

export async function listPublicEvents(
  options: ListPublicEventsOptions = {}
): Promise<PublicEventCard[]> {
  const client = options.prismaClient ?? defaultPrisma;
  const now = options.now ?? new Date();
  const events = await client.event.findMany({
    where: publicEventListingWhere(now, options.chapterSlug),
    include: publicEventInclude(),
    orderBy: [{ startTime: 'asc' }, { title: 'asc' }],
    take: options.take,
    skip: options.skip,
  });
  const viewerRegistrations = await getViewerRegistrationsByEventId(
    client,
    events.map(event => event.id),
    options.viewer?.hackerId
  );

  return events.map(event =>
    buildPublicEventCard(event, viewerRegistrations.get(event.id) ?? null, now)
  );
}

export async function getPublicEventBySlug(
  input: GetPublicEventBySlugInput
): Promise<PublicEventDetail | null> {
  const client = input.prismaClient ?? defaultPrisma;
  const now = input.now ?? new Date();
  const event = await client.event.findFirst({
    where: {
      ...publicEventVisibilityWhere(input.chapterSlug),
      slug: input.eventSlug,
    },
    include: publicEventInclude(),
  });

  if (!event) return null;

  const [viewerRegistration, readPermissionContext] = await Promise.all([
    getViewerRegistrationState(event.id, input.viewer?.hackerId, client),
    getPublicEventReadPermissionContext(event, input.viewer?.hackerId, client),
  ]);
  const viewerCanViewApprovedDetails =
    canViewApprovedOnlyEventDetailsWithContext({
      ...readPermissionContext,
      viewerRegistration,
    });

  return redactPublicEventForViewer(event, {
    viewerRegistration,
    viewerCanViewApprovedDetails,
    viewerIsSignedIn: Boolean(input.viewer?.hackerId),
    approvedCalendarDetails: input.includeApprovedCalendarDetails,
    now,
  });
}

export async function getViewerRegistrationState(
  eventId: EntityId,
  viewerHackerId?: EntityId | null,
  prismaClient: PublicEventsPrismaClient = defaultPrisma
): Promise<PublicViewerRegistrationState | null> {
  if (!viewerHackerId) return null;

  const registration = await prismaClient.eventRegistration.findFirst({
    where: {
      eventId,
      hackerId: viewerHackerId,
      cancelledAt: null,
    },
    orderBy: { createdAt: 'desc' },
  });

  return registration ? buildViewerRegistrationState(registration) : null;
}

export function redactPublicEventForViewer(
  event: PublicEventsEventRecord,
  options: RedactPublicEventOptions = {}
): PublicEventDetail {
  const now = options.now ?? new Date();
  const approvedDetailsVisible = canViewApprovedDetails({
    viewerRegistration: options.viewerRegistration,
    viewerCanViewApprovedDetails: options.viewerCanViewApprovedDetails,
    viewerCanManageRegistrations: options.viewerCanManageRegistrations,
  });
  const approvedDetails = approvedDetailsVisible
    ? asJsonObject(event.approvedDetailsJson)
    : null;
  const applicationControls = buildApplicationControls({
    event,
    viewerRegistration: options.viewerRegistration ?? null,
    viewerIsSignedIn:
      options.viewerIsSignedIn === true || Boolean(options.viewerRegistration),
    approvedCount: options.approvedCount,
    now,
  });

  return {
    ...buildPublicEventCard(
      event,
      options.viewerRegistration ?? null,
      now,
      options.approvedCount
    ),
    description: event.description ?? null,
    publicProgramLabel: event.publicProgramLabel ?? event.programType ?? null,
    publicSponsorText: null,
    publicExpertText: null,
    approvedDetailsJson: approvedDetails,
    approvedDetailsVisible,
    applicationControls,
    applicationQuestionSet: buildApplicationQuestionSet(event),
    viewerRegistration: options.viewerRegistration ?? null,
    addToCalendar: buildAddToCalendarPayload(event, {
      includeApprovedDetails:
        approvedDetailsVisible && options.approvedCalendarDetails === true,
    }),
  };
}

export function canViewApprovedDetails(input: {
  viewerRegistration?: Pick<PublicViewerRegistrationState, 'status'> | null;
  viewerCanViewApprovedDetails?: boolean;
  viewerCanManageRegistrations?: boolean;
}): boolean {
  return (
    input.viewerRegistration?.status === 'APPROVED' ||
    input.viewerCanViewApprovedDetails === true ||
    input.viewerCanManageRegistrations === true
  );
}

export function buildAddToCalendarPayload(
  event: Pick<
    PublicEventsEventRecord,
    | 'title'
    | 'description'
    | 'publicLocation'
    | 'startTime'
    | 'endTime'
    | 'chapter'
    | 'approvedDetailsJson'
  >,
  options: { includeApprovedDetails?: boolean } = {}
): AddToCalendarPayload {
  const approvedDetailsText =
    options.includeApprovedDetails === true
      ? approvedDetailsToCalendarText(event.approvedDetailsJson)
      : null;

  return {
    title: event.title,
    description: joinDescriptionParts(event.description, approvedDetailsText),
    location: event.publicLocation ?? null,
    startTime: event.startTime,
    endTime: event.endTime ?? null,
    timezone: event.chapter.timezone,
  };
}

export function getPublicEventStatus(
  event: Pick<
    PublicEventsEventRecord,
    'startTime' | 'endTime' | 'applicationsOpen' | 'capacity' | '_count'
  >,
  approvedCount = event._count?.registrations ?? 0,
  now: Date = new Date()
): PublicEventStatus {
  return getApplicationPublicStatus({
    applicationsOpen: event.applicationsOpen,
    capacity: event.capacity,
    approvedCount,
    startTime: event.startTime,
    endTime: event.endTime,
    now,
    waitlistAvailable: true,
  });
}

async function getViewerRegistrationsByEventId(
  client: PublicEventsPrismaClient,
  eventIds: EntityId[],
  viewerHackerId?: EntityId | null
): Promise<Map<EntityId, PublicViewerRegistrationState>> {
  if (!viewerHackerId || eventIds.length === 0) {
    return new Map();
  }

  const registrations = await client.eventRegistration.findMany({
    where: {
      eventId: { in: eventIds },
      hackerId: viewerHackerId,
      cancelledAt: null,
    },
  });

  return new Map(
    registrations.map(registration => [
      registration.eventId,
      buildViewerRegistrationState(registration),
    ])
  );
}

function buildPublicEventCard(
  event: PublicEventsEventRecord,
  viewerRegistration: Pick<PublicViewerRegistrationState, 'status'> | null,
  now: Date,
  approvedCount?: number
): PublicEventCard {
  const chapter = {
    id: event.chapter.id,
    slug: event.chapter.slug,
    name: event.chapter.name,
    timezone: event.chapter.timezone,
  };

  return {
    id: event.id,
    slug: event.slug,
    chapterSlug: event.chapter.slug,
    chapterName: event.chapter.name,
    chapter,
    title: event.title,
    publicLocation: event.publicLocation ?? null,
    startTime: event.startTime,
    endTime: event.endTime ?? null,
    publicStatus: getPublicEventStatus(event, approvedCount, now),
    viewerRegistrationStatus: viewerRegistration?.status,
  };
}

function buildViewerRegistrationState(
  registration: PublicEventsRegistrationRecord
): PublicViewerRegistrationState {
  return {
    id: registration.id,
    status: registration.status,
    submittedAt: registration.submittedAt ?? null,
    cancelledAt: registration.cancelledAt ?? null,
    publicSafeMessage:
      registration.status === 'BLOCKED'
        ? GENERIC_BLOCKED_MESSAGE
        : (registration.publicSafeMessage ?? null),
    canEditAnswers: registration.status === 'PENDING',
    canCancel: CANCELLABLE_REGISTRATION_STATUSES.includes(registration.status),
    answersJson: asJsonObject(registration.answersJson),
  };
}

function buildApplicationControls(input: {
  event: PublicEventsEventRecord;
  viewerRegistration: PublicViewerRegistrationState | null;
  viewerIsSignedIn: boolean;
  approvedCount?: number;
  now: Date;
}): ApplicationControlsState {
  const { event } = input;

  return buildApplicationControlsState({
    applicationMode: event.applicationMode,
    applicationsOpen: event.applicationsOpen,
    applicationsClosedAt: event.applicationsClosedAt ?? null,
    applicationsCloseReason: event.applicationsCloseReason ?? null,
    capacity: event.capacity ?? null,
    approvedCount: input.approvedCount ?? event._count?.registrations ?? 0,
    autoPromoteWaitlist: event.autoPromoteWaitlist ?? false,
    startTime: event.startTime,
    endTime: event.endTime,
    now: input.now,
    viewerSignedIn: input.viewerIsSignedIn,
    viewerRegistration: input.viewerRegistration,
    waitlistAvailable: true,
    includeCloseReason: true,
  });
}

function buildApplicationQuestionSet(
  event: PublicEventsEventRecord
): ApplicationQuestionSet {
  const eventFields = parseEventFields(event.applicationQuestionsJson);

  return {
    siteFields: [],
    chapterFields: [],
    eventFields,
    composedFields: eventFields,
    eventId: event.id,
  };
}

function parseEventFields(
  value: JsonValue | null | undefined
): TemplateFieldDefinition[] {
  if (!Array.isArray(value)) return [];

  return parseTemplateFieldsJson(value, 'event.applicationQuestionsJson', {
    allowSiteRequiredFieldIds: false,
  });
}

async function getPublicEventReadPermissionContext(
  event: PublicEventsEventRecord,
  viewerHackerId: EntityId | null | undefined,
  client: PublicEventsPrismaClient
): Promise<{
  actor: PublicEventsHackerRecord | null;
  chapterMembership: PublicEventsChapterMembershipRecord | null;
  staff: PublicEventsStaffRecord | null;
}> {
  if (!viewerHackerId) {
    return {
      actor: null,
      chapterMembership: null,
      staff: null,
    };
  }

  const [actor, chapterMembership, staff] = await Promise.all([
    getViewerActor(client, viewerHackerId),
    client.chapterMembership.findFirst({
      where: {
        chapterId: event.chapterId,
        hackerId: viewerHackerId,
      },
      select: {
        role: true,
        status: true,
      },
    }),
    client.eventStaff.findFirst({
      where: {
        eventId: event.id,
        hackerId: viewerHackerId,
        role: { in: ['MC', 'CO_MC'] },
      },
      select: {
        role: true,
      },
    }),
  ]);

  return {
    actor,
    chapterMembership,
    staff,
  };
}

async function getViewerActor(
  client: PublicEventsPrismaClient,
  viewerHackerId: EntityId
): Promise<PublicEventsHackerRecord | null> {
  if (typeof client.hacker.findUnique === 'function') {
    return client.hacker.findUnique({
      where: { id: viewerHackerId },
      select: { id: true, role: true },
    });
  }

  return client.hacker.findFirst({
    where: { id: viewerHackerId },
    select: { id: true, role: true },
  });
}

function asJsonObject(value: JsonValue | null | undefined): JsonObject | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return value;
}

function joinDescriptionParts(
  publicDescription?: string | null,
  approvedDetailsText?: string | null
): string | null {
  const parts = [publicDescription, approvedDetailsText].filter(
    (part): part is string => Boolean(part && part.trim())
  );

  return parts.length > 0 ? parts.join('\n\n') : null;
}

function approvedDetailsToCalendarText(
  approvedDetailsJson: JsonValue | null | undefined
): string | null {
  const details = asJsonObject(approvedDetailsJson);
  if (!details) return null;

  const preferredText = getStringValue(
    details,
    'calendarDescription',
    'description',
    'arrivalInstructions',
    'instructions'
  );

  if (preferredText) return preferredText;

  const stringDetails = Object.entries(details)
    .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
    .map(([key, value]) => `${humanizeJsonKey(key)}: ${value}`);

  return stringDetails.length > 0 ? stringDetails.join('\n') : null;
}

function getStringValue(value: JsonObject, ...keys: string[]): string | null {
  for (const key of keys) {
    const candidate = value[key];
    if (typeof candidate === 'string' && candidate.trim().length > 0) {
      return candidate;
    }
  }

  return null;
}

function humanizeJsonKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}

export { GENERIC_BLOCKED_MESSAGE };
