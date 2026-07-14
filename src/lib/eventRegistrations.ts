import prisma from './prisma';
import { Prisma } from '@prisma/client';
import { fetchMergedApplicationTemplate } from '@/lib/applicationTemplateQueries';
import { BLOCKED_REGISTRATION_MESSAGE } from '@/lib/moderation';
import { notifyEventDecision } from '@/lib/eventDecisionNotifications';
import type {
  EntityId,
  EventApplicationMode,
  EventRegistration,
  EventRegistrationAudit,
  EventStaffRole,
  JsonObject,
  JsonValue,
  PublicRegistrationResponse,
  RegistrationSource,
  RegistrationStatus,
  Role,
  TemplateFieldDefinition,
} from '@/types/event-management';

const APPLICANT_DECISION_STATUSES = [
  'APPROVED',
  'WAITLISTED',
  'DECLINED',
] as const satisfies readonly RegistrationStatus[];

const PUBLIC_REGISTRATION_DUPLICATE_STATUSES = [
  'PENDING',
  'APPROVED',
  'WAITLISTED',
  'DECLINED',
  'BLOCKED',
  'CANCELLED',
] as const satisfies readonly RegistrationStatus[];

const PUBLIC_REGISTRATION_CANCELABLE_STATUSES = [
  'PENDING',
  'APPROVED',
  'WAITLISTED',
] as const satisfies readonly RegistrationStatus[];

export type ApplicantDecisionStatus =
  (typeof APPLICANT_DECISION_STATUSES)[number];

export type PublicRegistrationFailureReason =
  | 'EVENT_NOT_FOUND'
  | 'APPLICATIONS_CLOSED'
  | 'VALIDATION_FAILED'
  | 'DUPLICATE_REGISTRATION'
  | 'REGISTRATION_NOT_FOUND'
  | 'EDIT_NOT_ALLOWED'
  | 'CANCEL_NOT_ALLOWED';

export type PublicRegistrationValidationIssueCode =
  | 'ANSWERS_REQUIRED'
  | 'REQUIRED_FIELD_MISSING'
  | 'INVALID_FIELD_TYPE'
  | 'INVALID_FIELD_OPTION'
  | 'INVALID_FIELD_LENGTH'
  | 'INVALID_FIELD_RANGE'
  | 'INVALID_FIELD_PATTERN';

export type PublicRegistrationValidationIssue = {
  code: PublicRegistrationValidationIssueCode;
  message: string;
  fieldId?: string;
};

export type PublicRegistrationActionResult =
  | {
      ok: true;
      registration: PublicRegistrationResponse;
      duplicate?: boolean;
    }
  | {
      ok: false;
      reason: PublicRegistrationFailureReason;
      issues?: PublicRegistrationValidationIssue[];
      registration?: PublicRegistrationResponse;
    };

export type RegistrationPermissionContext = {
  isSiteAdmin?: boolean;
  isChapterAdmin?: boolean;
  staffRole?: EventStaffRole | null;
};

type RegistrationStatusDenialReason =
  | 'UNAUTHORIZED'
  | 'CO_MC_CANNOT_DECIDE_APPLICANTS';

export type RegistrationStatusGuardResult =
  | { allowed: true }
  | { allowed: false; reason: RegistrationStatusDenialReason };

export type CreateInternalRegistrationInput = {
  eventId: EntityId;
  hackerId: EntityId;
  actorId: EntityId;
  status?: RegistrationStatus;
  source?: RegistrationSource;
  answersJson?: JsonObject | null;
  templateSnapshotJson?: TemplateFieldDefinition[] | null;
  publicSafeMessage?: string | null;
  internalReviewNotes?: string | null;
  changeJson?: JsonObject | null;
};

export type UpdateRegistrationStatusInput = {
  registrationId: EntityId;
  eventId: EntityId;
  actorId: EntityId;
  toStatus: RegistrationStatus;
  publicSafeMessage?: string | null;
  internalReviewNotes?: string | null;
  changeJson?: JsonObject | null;
};

export type ListEventRegistrationsOptions = {
  status?: RegistrationStatus;
  includeBannedUsers?: boolean;
  take?: number;
  skip?: number;
};

const ORGANIZER_REVIEW_STATUSES = [
  'PENDING',
  'APPROVED',
  'WAITLISTED',
  'DECLINED',
  'CANCELLED',
] as const satisfies readonly RegistrationStatus[];

export type SubmitPublicEventRegistrationInput = {
  eventId: EntityId;
  hackerId: EntityId;
  answersJson: unknown;
};

export type UpdatePendingPublicEventRegistrationInput = {
  eventId: EntityId;
  hackerId: EntityId;
  answersJson: unknown;
};

export type CancelPublicEventRegistrationInput = {
  eventId: EntityId;
  hackerId: EntityId;
  cancelledById?: EntityId;
};

export type WaitlistAutoPromotionInput = {
  eventId: EntityId;
  triggeringRegistrationId: EntityId;
  actorId: EntityId;
};

export type WaitlistAutoPromotionSkippedReason =
  | 'EVENT_NOT_FOUND'
  | 'AUTO_PROMOTE_DISABLED'
  | 'CAPACITY_NOT_CONFIGURED'
  | 'CAPACITY_FULL'
  | 'NO_WAITLISTED_REGISTRATION';

export type WaitlistAutoPromotionResult =
  | {
      promoted: true;
      registration: EventRegistrationRecord;
      approvedCountBeforePromotion: number;
      capacity: number;
    }
  | {
      promoted: false;
      reason: WaitlistAutoPromotionSkippedReason;
      approvedCountBeforePromotion?: number;
      capacity?: number | null;
    };

type PublicRegistrableEventRecord = {
  id: EntityId;
  chapterId: EntityId;
  applicationMode: EventApplicationMode;
  applicationsOpen: boolean;
};

type WaitlistCapacityEventRecord = {
  id: EntityId;
  capacity: number | null;
  autoPromoteWaitlist: boolean;
};

type EventRegistrationRecord = Omit<
  EventRegistration,
  'answersJson' | 'templateSnapshotJson'
> & {
  answersJson?: JsonValue | null;
  templateSnapshotJson?: JsonValue | null;
  event?: { chapterId?: EntityId | null } | null;
  hacker?: {
    id: EntityId;
    name: string;
    username?: string | null;
    email: string;
    role: Role;
    organizerNote?: { body: string } | null;
    userBans?: Array<{
      id: EntityId;
      publicSafeReason: string;
      createdAt: Date | string;
    }>;
  } | null;
  decidedBy?: { id: EntityId; name: string } | null;
  cancelledBy?: { id: EntityId; name: string } | null;
};

type EventRegistrationAuditRecord = EventRegistrationAudit;

type UserBanRecord = {
  hackerId: EntityId;
};

type ApplicationTemplateRecord = {
  id: EntityId;
  scope?: string;
  chapterId?: EntityId | null;
  fieldsJson: JsonValue;
  isActive?: boolean | null;
};

type MutationData = Prisma.EventRegistrationUncheckedUpdateInput;

type EventDelegate = {
  findUnique(
    args: Prisma.EventFindUniqueArgs
  ): Promise<WaitlistCapacityEventRecord | null>;
  findFirst(
    args: Prisma.EventFindFirstArgs
  ): Promise<PublicRegistrableEventRecord | null>;
};

type EventRegistrationDelegate = {
  findFirst(
    args: Prisma.EventRegistrationFindFirstArgs
  ): Promise<EventRegistrationRecord | null>;
  findMany(
    args: Prisma.EventRegistrationFindManyArgs
  ): Promise<EventRegistrationRecord[]>;
  create(
    args: Prisma.EventRegistrationCreateArgs
  ): Promise<EventRegistrationRecord>;
  update(
    args: Prisma.EventRegistrationUpdateArgs
  ): Promise<EventRegistrationRecord>;
  count(args: Prisma.EventRegistrationCountArgs): Promise<number>;
};

type EventRegistrationAuditDelegate = {
  create(
    args: Prisma.EventRegistrationAuditCreateArgs
  ): Promise<EventRegistrationAuditRecord>;
};

type ApplicationTemplateDelegate = {
  findFirst(
    args: Prisma.ApplicationTemplateFindFirstArgs
  ): Promise<ApplicationTemplateRecord | null>;
};

type UserBanDelegate = {
  findMany(args: Prisma.UserBanFindManyArgs): Promise<UserBanRecord[]>;
};

type EventManagementPrismaClient = {
  event: Pick<EventDelegate, 'findUnique' | 'findFirst'>;
  eventRegistration: EventRegistrationDelegate;
  eventRegistrationAudit: Pick<EventRegistrationAuditDelegate, 'create'>;
  applicationTemplate: Pick<ApplicationTemplateDelegate, 'findFirst'>;
  userBan: Pick<UserBanDelegate, 'findMany'>;
  $transaction<T>(
    callback: (tx: EventManagementPrismaClient) => Promise<T>,
    options?: { isolationLevel?: 'Serializable' }
  ): Promise<T>;
};

const SERIALIZABLE_TRANSACTION_OPTIONS = {
  isolationLevel: 'Serializable',
} as const;

type TransactionDb = Pick<
  Prisma.TransactionClient,
  | 'event'
  | 'eventRegistration'
  | 'eventRegistrationAudit'
  | 'applicationTemplate'
  | 'userBan'
>;

function createEventManagementClient(
  db: TransactionDb
): EventManagementPrismaClient {
  const adapter: EventManagementPrismaClient = {
    event: {
      findUnique: args => db.event.findUnique(args),
      findFirst: args => db.event.findFirst(args),
    },
    eventRegistration: {
      findFirst: args => db.eventRegistration.findFirst(args),
      findMany: args => db.eventRegistration.findMany(args),
      create: args => db.eventRegistration.create(args),
      update: args => db.eventRegistration.update(args),
      count: args => db.eventRegistration.count(args),
    },
    eventRegistrationAudit: {
      create: args => db.eventRegistrationAudit.create(args),
    },
    applicationTemplate: {
      findFirst: args => db.applicationTemplate.findFirst(args),
    },
    userBan: {
      findMany: args => db.userBan.findMany(args),
    },
    $transaction: callback => callback(adapter),
  };

  return adapter;
}

const client: EventManagementPrismaClient = {
  ...createEventManagementClient(prisma),
  $transaction: (callback, options) =>
    prisma.$transaction(
      tx => callback(createEventManagementClient(tx)),
      options
    ),
};

function toNullableJsonInput(
  value: JsonValue | readonly TemplateFieldDefinition[] | null | undefined
): Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue {
  if (value === null || value === undefined) {
    return Prisma.DbNull;
  }

  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export function isApplicantDecisionStatus(
  status: RegistrationStatus
): status is ApplicantDecisionStatus {
  return APPLICANT_DECISION_STATUSES.includes(
    status as ApplicantDecisionStatus
  );
}

function isDuplicatePublicRegistrationStatus(
  status: RegistrationStatus
): boolean {
  return PUBLIC_REGISTRATION_DUPLICATE_STATUSES.includes(status);
}

function canEditPublicRegistrationAnswers(status: RegistrationStatus): boolean {
  return status === 'PENDING';
}

function canCancelPublicRegistration(status: RegistrationStatus): boolean {
  return PUBLIC_REGISTRATION_CANCELABLE_STATUSES.includes(
    status as (typeof PUBLIC_REGISTRATION_CANCELABLE_STATUSES)[number]
  );
}

export function hasApprovedRegistrationCapacity(
  capacity: number | null | undefined,
  approvedCount: number
): boolean {
  if (capacity === null || capacity === undefined) {
    return true;
  }

  if (
    typeof capacity !== 'number' ||
    !Number.isFinite(capacity) ||
    capacity <= 0
  ) {
    return false;
  }

  return approvedCount < capacity;
}

export function canManageRegistrationStatus(
  context: RegistrationPermissionContext,
  toStatus: RegistrationStatus
): boolean {
  return getRegistrationStatusGuard(context, toStatus).allowed;
}

export function getRegistrationStatusGuard(
  context: RegistrationPermissionContext,
  toStatus: RegistrationStatus
): RegistrationStatusGuardResult {
  if (context.isSiteAdmin || context.isChapterAdmin) {
    return { allowed: true };
  }

  if (context.staffRole === 'MC') {
    return { allowed: true };
  }

  if (context.staffRole === 'CO_MC' && isApplicantDecisionStatus(toStatus)) {
    return { allowed: false, reason: 'CO_MC_CANNOT_DECIDE_APPLICANTS' };
  }

  if (context.staffRole === 'CO_MC') {
    return { allowed: true };
  }

  return { allowed: false, reason: 'UNAUTHORIZED' };
}

function shouldFilterActiveBansForRegistrations(isSiteAdmin: boolean): boolean {
  return !isSiteAdmin;
}

function filterRegistrationsForBanVisibility<
  TRegistration extends Pick<EventRegistration, 'hackerId'>,
>(
  registrations: TRegistration[],
  activeBannedHackerIds: Iterable<EntityId>,
  isSiteAdmin: boolean
): TRegistration[] {
  if (!shouldFilterActiveBansForRegistrations(isSiteAdmin)) {
    return registrations;
  }

  const bannedIds = new Set(activeBannedHackerIds);
  return registrations.filter(
    registration => !bannedIds.has(registration.hackerId)
  );
}

async function getActiveBannedHackerIds(
  hackerIds: EntityId[],
  db: EventManagementPrismaClient = client
): Promise<EntityId[]> {
  const uniqueHackerIds = Array.from(new Set(hackerIds));

  if (uniqueHackerIds.length === 0) {
    return [];
  }

  const bans = await db.userBan.findMany({
    where: {
      hackerId: { in: uniqueHackerIds },
      revokedAt: null,
    },
    select: { hackerId: true },
  });

  return Array.from(new Set(bans.map(ban => ban.hackerId)));
}

export async function listEventRegistrations(
  eventId: EntityId,
  isSiteAdmin: boolean,
  options: ListEventRegistrationsOptions = {},
  db: EventManagementPrismaClient = client
): Promise<EventRegistrationRecord[]> {
  const registrations = await db.eventRegistration.findMany({
    where: {
      eventId,
      ...(options.status ? { status: options.status } : {}),
    },
    include: {
      hacker: {
        select: {
          id: true,
          name: true,
          username: true,
          email: true,
          role: true,
          organizerNote: { select: { body: true } },
          userBans: {
            where: { revokedAt: null },
            select: {
              id: true,
              publicSafeReason: true,
              createdAt: true,
            },
            take: 1,
          },
        },
      },
      decidedBy: { select: { id: true, name: true } },
      cancelledBy: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: options.take,
    skip: options.skip,
  });

  if (
    (isSiteAdmin && options.includeBannedUsers) ||
    !shouldFilterActiveBansForRegistrations(isSiteAdmin)
  ) {
    return registrations;
  }

  const activeBannedHackerIds = await getActiveBannedHackerIds(
    registrations.map(registration => registration.hackerId),
    db
  );

  return filterRegistrationsForBanVisibility(
    registrations,
    activeBannedHackerIds,
    isSiteAdmin
  );
}

export async function countEventRegistrationsByStatus(
  eventId: EntityId,
  isSiteAdmin: boolean,
  db: EventManagementPrismaClient = client
): Promise<Partial<Record<RegistrationStatus, number>>> {
  const entries = await Promise.all(
    ORGANIZER_REVIEW_STATUSES.map(async status => {
      const count = await db.eventRegistration.count({
        where: {
          eventId,
          status,
          ...(!isSiteAdmin && {
            hacker: {
              userBans: { none: { revokedAt: null } },
            },
          }),
        },
      });
      return [status, count] as const;
    })
  );

  return Object.fromEntries(entries);
}

export async function createInternalEventRegistration(
  input: CreateInternalRegistrationInput,
  db: EventManagementPrismaClient = client
): Promise<EventRegistrationRecord> {
  const toStatus = input.status ?? 'PENDING';

  return db.$transaction(async tx => {
    const registration = await tx.eventRegistration.create({
      data: {
        eventId: input.eventId,
        hackerId: input.hackerId,
        status: toStatus,
        source: input.source ?? 'INTERNAL',
        answersJson: toNullableJsonInput(input.answersJson),
        templateSnapshotJson: toNullableJsonInput(input.templateSnapshotJson),
        publicSafeMessage: input.publicSafeMessage ?? null,
        internalReviewNotes: input.internalReviewNotes ?? null,
        decidedById: isApplicantDecisionStatus(toStatus) ? input.actorId : null,
        decidedAt: isApplicantDecisionStatus(toStatus) ? new Date() : null,
        ...(toStatus === 'WAITLISTED' ? { waitlistedAt: new Date() } : {}),
      },
    });

    await writeEventRegistrationAudit(
      {
        registrationId: registration.id,
        eventId: input.eventId,
        actorId: input.actorId,
        fromStatus: null,
        toStatus,
        changeJson: input.changeJson ?? {
          action: 'CREATE_INTERNAL_REGISTRATION',
          source: input.source ?? 'INTERNAL',
        },
      },
      tx
    );

    return registration;
  });
}

export async function submitPublicEventRegistration(
  input: SubmitPublicEventRegistrationInput,
  db: EventManagementPrismaClient = client
): Promise<PublicRegistrationActionResult> {
  return db.$transaction(async tx => {
    const event = await findPublicRegistrableEvent(input.eventId, tx);

    if (!event) {
      return { ok: false, reason: 'EVENT_NOT_FOUND' };
    }

    const existingRegistration = await findCurrentUserEventRegistration(
      input.eventId,
      input.hackerId,
      tx
    );
    const activeBannedHackerIds = await getActiveBannedHackerIds(
      [input.hackerId],
      tx
    );
    const isBanned = activeBannedHackerIds.length > 0;

    if (isBanned) {
      const blockedRegistration = await createOrUpdateBlockedRegistration(
        {
          eventId: input.eventId,
          hackerId: input.hackerId,
          existingRegistration,
        },
        tx
      );

      return {
        ok: true,
        registration: toPublicRegistrationResponse(blockedRegistration),
      };
    }

    if (
      existingRegistration &&
      isDuplicatePublicRegistrationStatus(existingRegistration.status)
    ) {
      return {
        ok: false,
        reason: 'DUPLICATE_REGISTRATION',
        registration: toPublicRegistrationResponse(existingRegistration),
      };
    }

    if (!event.applicationsOpen) {
      return { ok: false, reason: 'APPLICATIONS_CLOSED' };
    }

    const template = await fetchMergedApplicationTemplate({
      eventId: input.eventId,
      prisma: tx,
    });
    const issues = validatePublicRegistrationSubmission(
      input.answersJson,
      template.fields
    );

    if (issues.length > 0) {
      return {
        ok: false,
        reason: 'VALIDATION_FAILED',
        issues,
      };
    }

    const answers = normalizeRegistrationAnswers(input.answersJson);
    const toStatus = getInitialPublicRegistrationStatus(event.applicationMode);
    const registration = await tx.eventRegistration.create({
      data: {
        eventId: input.eventId,
        hackerId: input.hackerId,
        status: toStatus,
        source: 'WEBSITE',
        answersJson: toNullableJsonInput(answers),
        templateSnapshotJson: toNullableJsonInput(
          cloneTemplateSnapshot(template.fields)
        ),
        publicSafeMessage: null,
        internalReviewNotes: null,
        decidedById: isApplicantDecisionStatus(toStatus)
          ? input.hackerId
          : null,
        decidedAt: isApplicantDecisionStatus(toStatus) ? new Date() : null,
        waitlistedAt: toStatus === 'WAITLISTED' ? new Date() : null,
      },
    });

    await writeEventRegistrationAudit(
      {
        registrationId: registration.id,
        eventId: input.eventId,
        actorId: input.hackerId,
        fromStatus: null,
        toStatus,
        changeJson: {
          action: 'SUBMIT_PUBLIC_REGISTRATION',
          source: 'WEBSITE',
          applicationMode: event.applicationMode,
        },
      },
      tx
    );

    return {
      ok: true,
      registration: toPublicRegistrationResponse(registration),
    };
  });
}

export async function updatePendingPublicEventRegistration(
  input: UpdatePendingPublicEventRegistrationInput,
  db: EventManagementPrismaClient = client
): Promise<PublicRegistrationActionResult> {
  return db.$transaction(async tx => {
    const existingRegistration = await findCurrentUserEventRegistration(
      input.eventId,
      input.hackerId,
      tx
    );

    if (!existingRegistration) {
      return { ok: false, reason: 'REGISTRATION_NOT_FOUND' };
    }

    if (!canEditPublicRegistrationAnswers(existingRegistration.status)) {
      return {
        ok: false,
        reason: 'EDIT_NOT_ALLOWED',
        registration: toPublicRegistrationResponse(existingRegistration),
      };
    }

    const template = await fetchMergedApplicationTemplate({
      eventId: input.eventId,
      prisma: tx,
    });
    const issues = validatePublicRegistrationSubmission(
      input.answersJson,
      template.fields
    );

    if (issues.length > 0) {
      return {
        ok: false,
        reason: 'VALIDATION_FAILED',
        issues,
        registration: toPublicRegistrationResponse(existingRegistration),
      };
    }

    const answers = normalizeRegistrationAnswers(input.answersJson);
    const registration = await tx.eventRegistration.update({
      where: { id: existingRegistration.id },
      data: {
        answersJson: toNullableJsonInput(answers),
        templateSnapshotJson: toNullableJsonInput(
          cloneTemplateSnapshot(template.fields)
        ),
      },
    });

    await writeEventRegistrationAudit(
      {
        registrationId: registration.id,
        eventId: input.eventId,
        actorId: input.hackerId,
        fromStatus: existingRegistration.status,
        toStatus: registration.status,
        changeJson: {
          action: 'EDIT_PUBLIC_REGISTRATION_ANSWERS',
          source: 'WEBSITE',
          submittedAtPreserved: true,
        },
      },
      tx
    );

    return {
      ok: true,
      registration: toPublicRegistrationResponse(registration),
    };
  });
}

export async function cancelPublicEventRegistration(
  input: CancelPublicEventRegistrationInput,
  db: EventManagementPrismaClient = client
): Promise<PublicRegistrationActionResult> {
  let promotedRegistrationId: string | null = null;
  const result: PublicRegistrationActionResult = await db.$transaction(
    async tx => {
      const existingRegistration = await findCurrentUserEventRegistration(
        input.eventId,
        input.hackerId,
        tx
      );

      if (!existingRegistration) {
        return { ok: false, reason: 'REGISTRATION_NOT_FOUND' };
      }

      if (!canCancelPublicRegistration(existingRegistration.status)) {
        return {
          ok: false,
          reason: 'CANCEL_NOT_ALLOWED',
          registration: toPublicRegistrationResponse(existingRegistration),
        };
      }

      const cancelledAt = new Date();
      const cancelledById = input.cancelledById ?? input.hackerId;
      const registration = await tx.eventRegistration.update({
        where: { id: existingRegistration.id },
        data: {
          status: 'CANCELLED',
          cancelledAt,
          cancelledById,
        },
      });

      await writeEventRegistrationAudit(
        {
          registrationId: registration.id,
          eventId: input.eventId,
          actorId: cancelledById,
          fromStatus: existingRegistration.status,
          toStatus: 'CANCELLED',
          changeJson: {
            action: 'CANCEL_PUBLIC_REGISTRATION',
            source: 'WEBSITE',
            cancelledBySelf: cancelledById === input.hackerId,
          },
        },
        tx
      );

      if (existingRegistration.status === 'APPROVED') {
        const promotion =
          await autoPromoteWaitlistAfterApprovedCancellationInTransaction(
            {
              eventId: input.eventId,
              triggeringRegistrationId: registration.id,
              actorId: cancelledById,
            },
            tx
          );
        if (promotion.promoted) {
          promotedRegistrationId = promotion.registration.id;
        }
      }

      return {
        ok: true,
        registration: toPublicRegistrationResponse(registration),
      };
    },
    SERIALIZABLE_TRANSACTION_OPTIONS
  );

  if (promotedRegistrationId) {
    await notifyEventDecision({
      eventId: input.eventId,
      registrationId: promotedRegistrationId,
      status: 'APPROVED',
    });
  }

  return result;
}

export async function countApprovedEventRegistrations(
  eventId: EntityId,
  db: EventManagementPrismaClient = client
): Promise<number> {
  const where: Prisma.EventRegistrationWhereInput = {
    eventId,
    status: 'APPROVED',
    cancelledAt: null,
  };

  if (typeof db.eventRegistration.count === 'function') {
    return db.eventRegistration.count({ where });
  }

  const approvedRegistrations = await db.eventRegistration.findMany({
    where,
    select: { id: true },
  });

  return approvedRegistrations.length;
}

export async function findOldestWaitlistedEventRegistration(
  eventId: EntityId,
  db: EventManagementPrismaClient = client
): Promise<EventRegistrationRecord | null> {
  const waitlistedRegistrations = await db.eventRegistration.findMany({
    where: {
      eventId,
      status: 'WAITLISTED',
      cancelledAt: null,
    },
    orderBy: [{ waitlistedAt: 'asc' }, { createdAt: 'asc' }],
  });

  return waitlistedRegistrations.sort(compareWaitlistOrder)[0] ?? null;
}

export async function autoPromoteWaitlistAfterApprovedCancellation(
  input: WaitlistAutoPromotionInput,
  db: EventManagementPrismaClient = client
): Promise<WaitlistAutoPromotionResult> {
  return db.$transaction(
    tx => autoPromoteWaitlistAfterApprovedCancellationInTransaction(input, tx),
    SERIALIZABLE_TRANSACTION_OPTIONS
  );
}

export async function updateEventRegistrationStatus(
  input: UpdateRegistrationStatusInput,
  db: EventManagementPrismaClient = client
): Promise<EventRegistrationRecord | null> {
  return db.$transaction(async tx => {
    const existingRegistration = await tx.eventRegistration.findFirst({
      where: {
        id: input.registrationId,
        eventId: input.eventId,
      },
    });

    if (!existingRegistration) {
      return null;
    }

    if (existingRegistration.status === input.toStatus) {
      return existingRegistration;
    }

    const updateData = buildRegistrationStatusUpdateData(input);

    const registration = await tx.eventRegistration.update({
      where: { id: input.registrationId },
      data: updateData,
    });

    await writeEventRegistrationAudit(
      {
        registrationId: input.registrationId,
        eventId: input.eventId,
        actorId: input.actorId,
        fromStatus: existingRegistration.status,
        toStatus: input.toStatus,
        changeJson: input.changeJson ?? {
          action: 'UPDATE_REGISTRATION_STATUS',
          publicSafeMessageChanged:
            input.publicSafeMessage !== undefined &&
            input.publicSafeMessage !== existingRegistration.publicSafeMessage,
          internalReviewNotesChanged:
            input.internalReviewNotes !== undefined &&
            input.internalReviewNotes !==
              existingRegistration.internalReviewNotes,
        },
      },
      tx
    );

    return registration;
  });
}

function validatePublicRegistrationSubmission(
  answersJson: unknown,
  fields: readonly TemplateFieldDefinition[]
): PublicRegistrationValidationIssue[] {
  if (!isJsonObject(answersJson)) {
    return [
      {
        code: 'ANSWERS_REQUIRED',
        message: 'Application answers must be submitted as an object.',
      },
    ];
  }

  const issues: PublicRegistrationValidationIssue[] = [];

  for (const field of fields) {
    const value = answersJson[field.id];

    if (field.required && isEmptyAnswer(value)) {
      issues.push({
        code: 'REQUIRED_FIELD_MISSING',
        message: `${field.label} is required.`,
        fieldId: field.id,
      });
      continue;
    }

    if (isEmptyAnswer(value)) {
      continue;
    }

    issues.push(...validateRegistrationAnswerForField(field, value));
  }

  return issues;
}

function toPublicRegistrationResponse(
  registration: Pick<
    EventRegistrationRecord,
    'id' | 'status' | 'submittedAt' | 'createdAt' | 'publicSafeMessage'
  >
): PublicRegistrationResponse {
  return {
    id: registration.id,
    status: registration.status,
    submittedAt: registration.submittedAt ?? registration.createdAt,
    publicSafeMessage:
      registration.status === 'BLOCKED'
        ? BLOCKED_REGISTRATION_MESSAGE
        : (registration.publicSafeMessage ?? null),
  };
}

async function writeEventRegistrationAudit(
  input: {
    registrationId: EntityId;
    eventId: EntityId;
    actorId: EntityId;
    fromStatus?: RegistrationStatus | null;
    toStatus: RegistrationStatus;
    changeJson?: JsonObject | null;
  },
  db: EventManagementPrismaClient = client
): Promise<EventRegistrationAuditRecord> {
  return db.eventRegistrationAudit.create({
    data: {
      registrationId: input.registrationId,
      eventId: input.eventId,
      actorId: input.actorId,
      fromStatus: input.fromStatus ?? null,
      toStatus: input.toStatus,
      changeJson: toNullableJsonInput(input.changeJson),
    },
  });
}

async function findPublicRegistrableEvent(
  eventId: EntityId,
  db: EventManagementPrismaClient
): Promise<PublicRegistrableEventRecord | null> {
  return db.event.findFirst({
    where: {
      id: eventId,
      status: 'PUBLISHED',
      visibility: 'PUBLIC',
    },
    select: {
      id: true,
      chapterId: true,
      applicationMode: true,
      applicationsOpen: true,
    },
  }) as Promise<PublicRegistrableEventRecord | null>;
}

async function findWaitlistCapacityEvent(
  eventId: EntityId,
  db: EventManagementPrismaClient
): Promise<WaitlistCapacityEventRecord | null> {
  return db.event.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      capacity: true,
      autoPromoteWaitlist: true,
    },
  }) as Promise<WaitlistCapacityEventRecord | null>;
}

async function findCurrentUserEventRegistration(
  eventId: EntityId,
  hackerId: EntityId,
  db: EventManagementPrismaClient
): Promise<EventRegistrationRecord | null> {
  return db.eventRegistration.findFirst({
    where: {
      eventId,
      hackerId,
    },
  });
}

async function createOrUpdateBlockedRegistration(
  input: {
    eventId: EntityId;
    hackerId: EntityId;
    existingRegistration?: EventRegistrationRecord | null;
  },
  db: EventManagementPrismaClient
): Promise<EventRegistrationRecord> {
  if (input.existingRegistration) {
    const registration = await db.eventRegistration.update({
      where: { id: input.existingRegistration.id },
      data: {
        status: 'BLOCKED',
        source: 'WEBSITE',
        publicSafeMessage: BLOCKED_REGISTRATION_MESSAGE,
      },
    });

    await writeEventRegistrationAudit(
      {
        registrationId: registration.id,
        eventId: input.eventId,
        actorId: input.hackerId,
        fromStatus: input.existingRegistration.status,
        toStatus: 'BLOCKED',
        changeJson: {
          action: 'BLOCK_PUBLIC_REGISTRATION',
          source: 'WEBSITE',
        },
      },
      db
    );

    return registration;
  }

  const registration = await db.eventRegistration.create({
    data: {
      eventId: input.eventId,
      hackerId: input.hackerId,
      status: 'BLOCKED',
      source: 'WEBSITE',
      answersJson: Prisma.DbNull,
      templateSnapshotJson: Prisma.DbNull,
      publicSafeMessage: BLOCKED_REGISTRATION_MESSAGE,
      internalReviewNotes: null,
    },
  });

  await writeEventRegistrationAudit(
    {
      registrationId: registration.id,
      eventId: input.eventId,
      actorId: input.hackerId,
      fromStatus: null,
      toStatus: 'BLOCKED',
      changeJson: {
        action: 'BLOCK_PUBLIC_REGISTRATION',
        source: 'WEBSITE',
      },
    },
    db
  );

  return registration;
}

function getInitialPublicRegistrationStatus(
  applicationMode: EventApplicationMode
): RegistrationStatus {
  if (applicationMode === 'OPEN_RSVP') {
    return 'APPROVED';
  }

  return 'PENDING';
}

function buildRegistrationStatusUpdateData(
  input: UpdateRegistrationStatusInput
): MutationData {
  const updateData: MutationData = {
    status: input.toStatus,
  };

  if (input.publicSafeMessage !== undefined) {
    updateData.publicSafeMessage = input.publicSafeMessage;
  }

  if (input.internalReviewNotes !== undefined) {
    updateData.internalReviewNotes = input.internalReviewNotes;
  }

  if (isApplicantDecisionStatus(input.toStatus)) {
    updateData.decidedById = input.actorId;
    updateData.decidedAt = new Date();
  }

  if (input.toStatus === 'WAITLISTED') {
    updateData.waitlistedAt = new Date();
  }

  return updateData;
}

async function autoPromoteWaitlistAfterApprovedCancellationInTransaction(
  input: WaitlistAutoPromotionInput,
  db: EventManagementPrismaClient
): Promise<WaitlistAutoPromotionResult> {
  const event = await findWaitlistCapacityEvent(input.eventId, db);

  if (!event) {
    return { promoted: false, reason: 'EVENT_NOT_FOUND' };
  }

  if (!event.autoPromoteWaitlist) {
    return { promoted: false, reason: 'AUTO_PROMOTE_DISABLED' };
  }

  const approvedCount = await countApprovedEventRegistrations(
    input.eventId,
    db
  );

  if (event.capacity === null) {
    return {
      promoted: false,
      reason: 'CAPACITY_NOT_CONFIGURED',
      approvedCountBeforePromotion: approvedCount,
      capacity: event.capacity,
    };
  }

  if (!hasApprovedRegistrationCapacity(event.capacity, approvedCount)) {
    return {
      promoted: false,
      reason: 'CAPACITY_FULL',
      approvedCountBeforePromotion: approvedCount,
      capacity: event.capacity,
    };
  }

  const waitlistedRegistration = await findOldestWaitlistedEventRegistration(
    input.eventId,
    db
  );

  if (!waitlistedRegistration) {
    return {
      promoted: false,
      reason: 'NO_WAITLISTED_REGISTRATION',
      approvedCountBeforePromotion: approvedCount,
      capacity: event.capacity,
    };
  }

  const promotedRegistration = await db.eventRegistration.update({
    where: { id: waitlistedRegistration.id },
    data: {
      status: 'APPROVED',
      decidedById: input.actorId,
      decidedAt: new Date(),
      publicSafeMessage: null,
    },
  });

  await writeEventRegistrationAudit(
    {
      registrationId: promotedRegistration.id,
      eventId: input.eventId,
      actorId: input.actorId,
      fromStatus: 'WAITLISTED',
      toStatus: 'APPROVED',
      changeJson: {
        action: 'AUTO_PROMOTE_WAITLISTED_REGISTRATION',
        automatic: true,
        triggeringRegistrationId: input.triggeringRegistrationId,
        approvedCountBeforePromotion: approvedCount,
        capacity: event.capacity,
      },
    },
    db
  );

  return {
    promoted: true,
    registration: promotedRegistration,
    approvedCountBeforePromotion: approvedCount,
    capacity: event.capacity,
  };
}

function compareWaitlistOrder(
  left: EventRegistrationRecord,
  right: EventRegistrationRecord
): number {
  const leftWaitlistTime = getWaitlistOrderTime(left);
  const rightWaitlistTime = getWaitlistOrderTime(right);

  if (leftWaitlistTime !== rightWaitlistTime) {
    return leftWaitlistTime - rightWaitlistTime;
  }

  return left.id.localeCompare(right.id);
}

function getWaitlistOrderTime(registration: EventRegistrationRecord): number {
  const orderedAt =
    toTime(registration.waitlistedAt) ??
    toTime(registration.submittedAt) ??
    toTime(registration.createdAt);

  return orderedAt ?? 0;
}

function toTime(value: Date | string | null | undefined): number | null {
  if (!value) {
    return null;
  }

  const time =
    value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function normalizeRegistrationAnswers(answersJson: unknown): JsonObject {
  return isJsonObject(answersJson) ? answersJson : {};
}

function validateRegistrationAnswerForField(
  field: TemplateFieldDefinition,
  value: JsonValue | undefined
): PublicRegistrationValidationIssue[] {
  const issues: PublicRegistrationValidationIssue[] = [];
  const stringValue = typeof value === 'string' ? value.trim() : null;
  const numericValue = getNumericAnswerValue(value);

  if (!isAnswerTypeValid(field, value)) {
    issues.push({
      code: 'INVALID_FIELD_TYPE',
      message: `${field.label} has an invalid value.`,
      fieldId: field.id,
    });
    return issues;
  }

  if (
    field.type === 'SELECT' &&
    field.options?.length &&
    typeof value === 'string' &&
    !field.options.some(option => option.value === value)
  ) {
    issues.push({
      code: 'INVALID_FIELD_OPTION',
      message: `${field.label} must use one of the available options.`,
      fieldId: field.id,
    });
  }

  if (
    field.type === 'MULTI_SELECT' &&
    field.options?.length &&
    Array.isArray(value)
  ) {
    const allowedValues = new Set(field.options.map(option => option.value));
    const hasInvalidOption = value.some(
      optionValue =>
        typeof optionValue !== 'string' || !allowedValues.has(optionValue)
    );

    if (hasInvalidOption) {
      issues.push({
        code: 'INVALID_FIELD_OPTION',
        message: `${field.label} must use available options.`,
        fieldId: field.id,
      });
    }
  }

  if (field.type === 'EMAIL' && stringValue && !isEmailLike(stringValue)) {
    issues.push({
      code: 'INVALID_FIELD_TYPE',
      message: `${field.label} must be a valid email address.`,
      fieldId: field.id,
    });
  }

  if (field.type === 'URL' && stringValue && !isUrlLike(stringValue)) {
    issues.push({
      code: 'INVALID_FIELD_TYPE',
      message: `${field.label} must be a valid URL.`,
      fieldId: field.id,
    });
  }

  if (
    stringValue !== null &&
    field.validation?.minLength !== undefined &&
    stringValue.length < field.validation.minLength
  ) {
    issues.push({
      code: 'INVALID_FIELD_LENGTH',
      message: `${field.label} is too short.`,
      fieldId: field.id,
    });
  }

  if (
    stringValue !== null &&
    field.validation?.maxLength !== undefined &&
    stringValue.length > field.validation.maxLength
  ) {
    issues.push({
      code: 'INVALID_FIELD_LENGTH',
      message: `${field.label} is too long.`,
      fieldId: field.id,
    });
  }

  if (
    numericValue !== null &&
    field.validation?.min !== undefined &&
    numericValue < field.validation.min
  ) {
    issues.push({
      code: 'INVALID_FIELD_RANGE',
      message: `${field.label} is below the allowed minimum.`,
      fieldId: field.id,
    });
  }

  if (
    numericValue !== null &&
    field.validation?.max !== undefined &&
    numericValue > field.validation.max
  ) {
    issues.push({
      code: 'INVALID_FIELD_RANGE',
      message: `${field.label} is above the allowed maximum.`,
      fieldId: field.id,
    });
  }

  if (stringValue !== null && field.validation?.pattern) {
    try {
      const pattern = new RegExp(field.validation.pattern);

      if (!pattern.test(stringValue)) {
        issues.push({
          code: 'INVALID_FIELD_PATTERN',
          message: `${field.label} does not match the expected format.`,
          fieldId: field.id,
        });
      }
    } catch {
      issues.push({
        code: 'INVALID_FIELD_PATTERN',
        message: `${field.label} has an invalid validation pattern.`,
        fieldId: field.id,
      });
    }
  }

  return issues;
}

function isAnswerTypeValid(
  field: TemplateFieldDefinition,
  value: JsonValue | undefined
): boolean {
  switch (field.type) {
    case 'CHECKBOX':
      return typeof value === 'boolean';
    case 'MULTI_SELECT':
      return (
        Array.isArray(value) &&
        value.every(optionValue => typeof optionValue === 'string')
      );
    case 'NUMBER':
      return getNumericAnswerValue(value) !== null;
    case 'TEXT':
    case 'TEXTAREA':
    case 'EMAIL':
    case 'PHONE':
    case 'URL':
    case 'SELECT':
    case 'DATE':
    case 'DATETIME':
      return typeof value === 'string';
  }
}

function getNumericAnswerValue(value: JsonValue | undefined): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim().length > 0) {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : null;
  }

  return null;
}

function isEmptyAnswer(value: JsonValue | undefined): boolean {
  if (value === undefined || value === null) {
    return true;
  }

  if (typeof value === 'string') {
    return value.trim().length === 0;
  }

  if (Array.isArray(value)) {
    return value.length === 0;
  }

  return false;
}

function isEmailLike(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isUrlLike(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cloneTemplateSnapshot(
  fields: readonly TemplateFieldDefinition[]
): TemplateFieldDefinition[] {
  return fields.map(field => ({
    ...field,
    options: field.options?.map(option => ({ ...option })),
    validation: field.validation ? { ...field.validation } : undefined,
  }));
}
