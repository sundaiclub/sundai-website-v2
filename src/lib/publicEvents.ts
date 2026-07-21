import prisma from '@/lib/prisma';
import type { Prisma } from '@prisma/client';
import {
  canAccessEventWorkspaceWithContext,
  canDecideRegistrationsWithContext,
  canPublishEventWithContext,
  canViewApprovedOnlyEventDetailsWithContext,
} from '@/lib/eventManagementAuth';
import {
  buildApplicationControlsState,
  getApplicationPublicStatus,
  parseTemplateFieldsJson,
} from '@/lib/applicationTemplates';
import { fetchMergedApplicationTemplate } from '@/lib/applicationTemplateQueries';
import type {
  AddToCalendarPayload,
  ApplicationControlsState,
  ApplicationQuestionSet,
  EntityId,
  EventApplicationMode,
  EventStaffRole,
  JsonObject,
  JsonValue,
  MergedApplicationTemplate,
  PublicEventCard,
  PublicEventDetail,
  PublicEventStatus,
  PublicViewerRegistrationState,
  RegistrationStatus,
  Role,
  TemplateFieldDefinition,
} from '@/types/event-management';

type PublicEventsDelegate<TRecord, TFindManyArgs, TFindFirstArgs> = {
  findMany(args?: TFindManyArgs): Promise<TRecord[]>;
  findFirst(args?: TFindFirstArgs): Promise<TRecord | null>;
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

const PUBLIC_EVENT_INCLUDE = {
  image: {
    select: {
      id: true,
      url: true,
      alt: true,
    },
  },
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
} satisfies Prisma.EventInclude;

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
  image?: {
    id: EntityId;
    url: string;
    alt?: string | null;
  } | null;
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
type PublicEventsEventFindManyArgs = Omit<
  Prisma.EventFindManyArgs,
  'include'
> & {
  include: typeof PUBLIC_EVENT_INCLUDE;
};
type PublicEventsEventFindFirstArgs = Omit<
  Prisma.EventFindFirstArgs,
  'include'
> & {
  include: typeof PUBLIC_EVENT_INCLUDE;
};

export type PublicEventsPrismaClient = {
  event: PublicEventsDelegate<
    PublicEventsEventRecord,
    PublicEventsEventFindManyArgs,
    PublicEventsEventFindFirstArgs
  > & {
    findUnique(args: unknown): Promise<{
      id: EntityId;
      chapterId?: EntityId | null;
      applicationQuestionsJson?: unknown;
      hideChapterDefaultQuestions?: boolean | null;
    } | null>;
  };
  applicationTemplate: {
    findFirst(args: unknown): Promise<{
      id: EntityId;
      scope?: string;
      chapterId?: EntityId | null;
      fieldsJson: unknown;
      isActive?: boolean | null;
    } | null>;
  };
  eventRegistration: PublicEventsDelegate<
    PublicEventsRegistrationRecord,
    Prisma.EventRegistrationFindManyArgs,
    Prisma.EventRegistrationFindFirstArgs
  >;
  hacker: {
    findUnique(
      args: Prisma.HackerFindUniqueArgs
    ): Promise<PublicEventsHackerRecord | null>;
  };
  chapterMembership: PublicEventsDelegate<
    PublicEventsChapterMembershipRecord,
    Prisma.ChapterMembershipFindManyArgs,
    Prisma.ChapterMembershipFindFirstArgs
  >;
  eventStaff: PublicEventsDelegate<
    PublicEventsStaffRecord,
    Prisma.EventStaffFindManyArgs,
    Prisma.EventStaffFindFirstArgs
  >;
};

export type PublicEventViewer = {
  hackerId?: EntityId | null;
  clerkId?: string | null;
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
  applicationQuestionSet?: ApplicationQuestionSet;
  reusableAnswersJson?: JsonObject | null;
  viewerRegistration?: PublicViewerRegistrationState | null;
  viewerCanManageRegistrations?: boolean;
  viewerCanViewApprovedDetails?: boolean;
  viewerCanEditEvent?: boolean;
  viewerCanManageEvent?: boolean;
  viewerIsSignedIn?: boolean;
  approvedCalendarDetails?: boolean;
  approvedCount?: number;
  now?: Date;
};

const defaultPrisma: PublicEventsPrismaClient = {
  event: {
    findMany: args =>
      prisma.event
        .findMany(args)
        .then(events => events as PublicEventsEventRecord[]),
    findFirst: args =>
      prisma.event
        .findFirst(args)
        .then(event => event as PublicEventsEventRecord | null),
    findUnique: args =>
      prisma.event.findUnique(args as Prisma.EventFindUniqueArgs),
  },
  applicationTemplate: {
    findFirst: args =>
      prisma.applicationTemplate.findFirst(
        args as Prisma.ApplicationTemplateFindFirstArgs
      ),
  },
  eventRegistration: {
    findMany: args =>
      prisma.eventRegistration
        .findMany(args)
        .then(
          registrations => registrations as PublicEventsRegistrationRecord[]
        ),
    findFirst: args =>
      prisma.eventRegistration
        .findFirst(args)
        .then(
          registration => registration as PublicEventsRegistrationRecord | null
        ),
  },
  hacker: {
    findUnique: args =>
      prisma.hacker
        .findUnique(args)
        .then(hacker => hacker as PublicEventsHackerRecord | null),
  },
  chapterMembership: {
    findMany: args =>
      prisma.chapterMembership
        .findMany(args)
        .then(
          memberships => memberships as PublicEventsChapterMembershipRecord[]
        ),
    findFirst: args =>
      prisma.chapterMembership
        .findFirst(args)
        .then(
          membership => membership as PublicEventsChapterMembershipRecord | null
        ),
  },
  eventStaff: {
    findMany: args =>
      prisma.eventStaff
        .findMany(args)
        .then(staff => staff as PublicEventsStaffRecord[]),
    findFirst: args =>
      prisma.eventStaff
        .findFirst(args)
        .then(staff => staff as PublicEventsStaffRecord | null),
  },
};
const CANCELLABLE_REGISTRATION_STATUSES: readonly RegistrationStatus[] = [
  'PENDING',
  'APPROVED',
  'WAITLISTED',
];
const GENERIC_BLOCKED_MESSAGE =
  'You are unable to register for this event at this time.';

function publicEventVisibilityWhere(
  chapterSlug?: string | null
): Prisma.EventWhereInput {
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
): Prisma.EventWhereInput {
  return {
    ...publicEventVisibilityWhere(chapterSlug),
    startTime: { gte: now },
  };
}

function publicEventInclude(): typeof PUBLIC_EVENT_INCLUDE {
  return PUBLIC_EVENT_INCLUDE;
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
  const [event, viewerHacker] = await Promise.all([
    client.event.findFirst({
      where: {
        ...publicEventVisibilityWhere(input.chapterSlug),
        slug: input.eventSlug,
      },
      include: publicEventInclude(),
    }),
    !input.viewer?.hackerId && input.viewer?.clerkId
      ? client.hacker.findUnique({
          where: { clerkId: input.viewer.clerkId },
          select: { id: true },
        })
      : Promise.resolve(null),
  ]);

  if (!event) return null;

  const viewerHackerId = input.viewer?.hackerId ?? viewerHacker?.id ?? null;

  const [viewerRegistration, readPermissionContext, mergedTemplate] =
    await Promise.all([
      getViewerRegistrationState(event.id, viewerHackerId, client),
      getPublicEventReadPermissionContext(event, viewerHackerId, client),
      fetchMergedApplicationTemplate({ eventId: event.id, prisma: client }),
    ]);
  const applicationQuestionSet = buildApplicationQuestionSet(
    event,
    mergedTemplate
  );
  const reusableAnswersJson = await getReusableAnswersForViewer({
    client,
    eventId: event.id,
    fields: applicationQuestionSet.composedFields,
    viewerHackerId: viewerRegistration ? null : viewerHackerId,
  });
  const viewerCanViewApprovedDetails =
    canViewApprovedOnlyEventDetailsWithContext({
      ...readPermissionContext,
      viewerRegistration,
    });
  const viewerCanManageRegistrations = canDecideRegistrationsWithContext(
    readPermissionContext
  );
  const viewerCanEditEvent = canPublishEventWithContext(readPermissionContext);
  const viewerCanManageEvent = canAccessEventWorkspaceWithContext(
    readPermissionContext
  );

  return redactPublicEventForViewer(event, {
    applicationQuestionSet,
    reusableAnswersJson,
    viewerRegistration,
    viewerCanManageRegistrations,
    viewerCanViewApprovedDetails,
    viewerCanEditEvent,
    viewerCanManageEvent,
    viewerIsSignedIn: Boolean(input.viewer?.hackerId || input.viewer?.clerkId),
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
    applicationQuestionSet:
      options.applicationQuestionSet ?? buildApplicationQuestionSet(event),
    reusableAnswersJson: options.reusableAnswersJson ?? null,
    viewerRegistration: options.viewerRegistration ?? null,
    viewerCanManageRegistrations: options.viewerCanManageRegistrations === true,
    viewerCanEditEvent: options.viewerCanEditEvent === true,
    viewerCanManageEvent: options.viewerCanManageEvent === true,
    addToCalendar: buildAddToCalendarPayload(event, {
      includeApprovedDetails:
        approvedDetailsVisible && options.approvedCalendarDetails === true,
    }),
  };
}

async function getReusableAnswersForViewer(input: {
  client: PublicEventsPrismaClient;
  eventId: EntityId;
  fields: readonly TemplateFieldDefinition[];
  viewerHackerId?: EntityId | null;
}): Promise<JsonObject> {
  const reusableFieldIds = input.fields
    .filter(field => field.reusePreviousAnswer === true)
    .map(field => field.id);

  if (!input.viewerHackerId || reusableFieldIds.length === 0) return {};

  const registrations = await input.client.eventRegistration.findMany({
    where: {
      hackerId: input.viewerHackerId,
      eventId: { not: input.eventId },
    },
    orderBy: { submittedAt: 'desc' },
    take: 50,
  });
  const answers: JsonObject = {};

  for (const registration of registrations ?? []) {
    const priorAnswers = asJsonObject(registration.answersJson);
    if (!priorAnswers) continue;

    for (const fieldId of reusableFieldIds) {
      if (answers[fieldId] !== undefined) continue;
      const value = priorAnswers[fieldId];
      if (isAnsweredValue(value)) answers[fieldId] = value;
    }

    if (Object.keys(answers).length === reusableFieldIds.length) break;
  }

  return answers;
}

function isAnsweredValue(value: JsonValue | undefined): value is JsonValue {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function canViewApprovedDetails(input: {
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

function getPublicEventStatus(
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
    image: event.image ?? null,
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
  event: PublicEventsEventRecord,
  mergedTemplate?: MergedApplicationTemplate | null
): ApplicationQuestionSet {
  const eventFields = parseEventFields(event.applicationQuestionsJson);
  const composedFields = mergedTemplate?.fields ?? eventFields;

  return {
    siteFields: composedFields.filter(field => field.siteRequired === true),
    chapterFields: [],
    eventFields,
    composedFields,
    siteTemplateId: mergedTemplate?.siteTemplateId ?? null,
    chapterTemplateId: mergedTemplate?.chapterTemplateId ?? null,
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
    client.hacker.findUnique({
      where: { id: viewerHackerId },
      select: { id: true, role: true },
    }),
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
