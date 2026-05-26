import prisma from './prisma'
import type {
  EntityId,
  EventRegistration,
  EventRegistrationAudit,
  EventStaffRole,
  JsonObject,
  RegistrationSource,
  RegistrationStatus,
  TemplateFieldDefinition,
} from '@/types/event-management'

export const APPLICANT_DECISION_STATUSES = [
  'APPROVED',
  'WAITLISTED',
  'DECLINED',
] as const satisfies readonly RegistrationStatus[]

export const ACTIVE_REGISTRATION_STATUSES = [
  'PENDING',
  'APPROVED',
  'WAITLISTED',
  'DECLINED',
  'BLOCKED',
] as const satisfies readonly RegistrationStatus[]

export const PUBLIC_SAFE_REGISTRATION_BLOCK_MESSAGE =
  'You are unable to register for this event at this time.'

export type ApplicantDecisionStatus =
  (typeof APPLICANT_DECISION_STATUSES)[number]

export type RegistrationPermissionContext = {
  isSiteAdmin?: boolean
  isChapterAdmin?: boolean
  staffRole?: EventStaffRole | null
}

export type RegistrationStatusDenialReason =
  | 'UNAUTHORIZED'
  | 'CO_MC_CANNOT_DECIDE_APPLICANTS'

export type RegistrationStatusGuardResult =
  | { allowed: true }
  | { allowed: false; reason: RegistrationStatusDenialReason }

export type CreateInternalRegistrationInput = {
  eventId: EntityId
  hackerId: EntityId
  actorId: EntityId
  status?: RegistrationStatus
  source?: RegistrationSource
  answersJson?: JsonObject | null
  templateSnapshotJson?: TemplateFieldDefinition[] | null
  publicSafeMessage?: string | null
  internalReviewNotes?: string | null
  changeJson?: JsonObject | null
}

export type UpdateRegistrationStatusInput = {
  registrationId: EntityId
  eventId: EntityId
  actorId: EntityId
  toStatus: RegistrationStatus
  publicSafeMessage?: string | null
  internalReviewNotes?: string | null
  changeJson?: JsonObject | null
}

export type ListEventRegistrationsOptions = {
  includeBannedUsers?: boolean
  take?: number
  skip?: number
}

type EventRegistrationRecord = EventRegistration & {
  event?: { chapterId?: EntityId | null } | null
}

type EventRegistrationAuditRecord = EventRegistrationAudit

type UserBanRecord = {
  hackerId: EntityId
}

type Delegate<TRecord> = {
  findUnique(args: Record<string, unknown>): Promise<TRecord | null>
  findFirst(args: Record<string, unknown>): Promise<TRecord | null>
  findMany(args: Record<string, unknown>): Promise<TRecord[]>
  create(args: Record<string, unknown>): Promise<TRecord>
  update(args: Record<string, unknown>): Promise<TRecord>
}

type EventManagementPrismaClient = {
  eventRegistration: Delegate<EventRegistrationRecord>
  eventRegistrationAudit: Pick<Delegate<EventRegistrationAuditRecord>, 'create'>
  userBan: Pick<Delegate<UserBanRecord>, 'findMany'>
  $transaction<T>(
    callback: (tx: EventManagementPrismaClient) => Promise<T>
  ): Promise<T>
}

const client = prisma as unknown as EventManagementPrismaClient

export function isApplicantDecisionStatus(
  status: RegistrationStatus
): status is ApplicantDecisionStatus {
  return APPLICANT_DECISION_STATUSES.includes(status as ApplicantDecisionStatus)
}

export function isActiveRegistrationStatus(
  status: RegistrationStatus
): boolean {
  return ACTIVE_REGISTRATION_STATUSES.includes(
    status as (typeof ACTIVE_REGISTRATION_STATUSES)[number]
  )
}

export function canReadEventRegistrations(
  context: RegistrationPermissionContext
): boolean {
  return Boolean(
    context.isSiteAdmin ||
      context.isChapterAdmin ||
      context.staffRole === 'MC'
  )
}

export function canManageRegistrationStatus(
  context: RegistrationPermissionContext,
  toStatus: RegistrationStatus
): boolean {
  return getRegistrationStatusGuard(context, toStatus).allowed
}

export function getRegistrationStatusGuard(
  context: RegistrationPermissionContext,
  toStatus: RegistrationStatus
): RegistrationStatusGuardResult {
  if (context.isSiteAdmin || context.isChapterAdmin) {
    return { allowed: true }
  }

  if (context.staffRole === 'MC') {
    return { allowed: true }
  }

  if (context.staffRole === 'CO_MC' && isApplicantDecisionStatus(toStatus)) {
    return { allowed: false, reason: 'CO_MC_CANNOT_DECIDE_APPLICANTS' }
  }

  if (context.staffRole === 'CO_MC') {
    return { allowed: true }
  }

  return { allowed: false, reason: 'UNAUTHORIZED' }
}

export function shouldFilterActiveBansForRegistrations(
  isSiteAdmin: boolean
): boolean {
  return !isSiteAdmin
}

export function filterRegistrationsForBanVisibility<
  TRegistration extends Pick<EventRegistration, 'hackerId'>,
>(
  registrations: TRegistration[],
  activeBannedHackerIds: Iterable<EntityId>,
  isSiteAdmin: boolean
): TRegistration[] {
  if (!shouldFilterActiveBansForRegistrations(isSiteAdmin)) {
    return registrations
  }

  const bannedIds = new Set(activeBannedHackerIds)
  return registrations.filter(
    (registration) => !bannedIds.has(registration.hackerId)
  )
}

export async function getActiveBannedHackerIds(
  hackerIds: EntityId[],
  db: EventManagementPrismaClient = client
): Promise<EntityId[]> {
  const uniqueHackerIds = Array.from(new Set(hackerIds))

  if (uniqueHackerIds.length === 0) {
    return []
  }

  const bans = await db.userBan.findMany({
    where: {
      hackerId: { in: uniqueHackerIds },
      revokedAt: null,
    },
    select: { hackerId: true },
  })

  return Array.from(new Set(bans.map((ban) => ban.hackerId)))
}

export async function listEventRegistrations(
  eventId: EntityId,
  isSiteAdmin: boolean,
  options: ListEventRegistrationsOptions = {},
  db: EventManagementPrismaClient = client
): Promise<EventRegistrationRecord[]> {
  const registrations = await db.eventRegistration.findMany({
    where: { eventId },
    orderBy: { createdAt: 'desc' },
    take: options.take,
    skip: options.skip,
  })

  if (
    (isSiteAdmin && options.includeBannedUsers) ||
    !shouldFilterActiveBansForRegistrations(isSiteAdmin)
  ) {
    return registrations
  }

  const activeBannedHackerIds = await getActiveBannedHackerIds(
    registrations.map((registration) => registration.hackerId),
    db
  )

  return filterRegistrationsForBanVisibility(
    registrations,
    activeBannedHackerIds,
    isSiteAdmin
  )
}

export async function createInternalEventRegistration(
  input: CreateInternalRegistrationInput,
  db: EventManagementPrismaClient = client
): Promise<EventRegistrationRecord> {
  const toStatus = input.status ?? 'PENDING'

  return db.$transaction(async (tx) => {
    const registration = await tx.eventRegistration.create({
      data: {
        eventId: input.eventId,
        hackerId: input.hackerId,
        status: toStatus,
        source: input.source ?? 'INTERNAL',
        answersJson: input.answersJson ?? null,
        templateSnapshotJson: input.templateSnapshotJson ?? null,
        publicSafeMessage: input.publicSafeMessage ?? null,
        internalReviewNotes: input.internalReviewNotes ?? null,
        decidedById: isApplicantDecisionStatus(toStatus) ? input.actorId : null,
        decidedAt: isApplicantDecisionStatus(toStatus) ? new Date() : null,
      },
    })

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
    )

    return registration
  })
}

export async function updateEventRegistrationStatus(
  input: UpdateRegistrationStatusInput,
  db: EventManagementPrismaClient = client
): Promise<EventRegistrationRecord | null> {
  return db.$transaction(async (tx) => {
    const existingRegistration = await tx.eventRegistration.findFirst({
      where: {
        id: input.registrationId,
        eventId: input.eventId,
      },
    })

    if (!existingRegistration) {
      return null
    }

    if (existingRegistration.status === input.toStatus) {
      return existingRegistration
    }

    const updateData = buildRegistrationStatusUpdateData(input)

    const registration = await tx.eventRegistration.update({
      where: { id: input.registrationId },
      data: updateData,
    })

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
            input.internalReviewNotes !== existingRegistration.internalReviewNotes,
        },
      },
      tx
    )

    return registration
  })
}

export async function writeEventRegistrationAudit(
  input: {
    registrationId: EntityId
    eventId: EntityId
    actorId: EntityId
    fromStatus?: RegistrationStatus | null
    toStatus: RegistrationStatus
    changeJson?: JsonObject | null
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
      changeJson: input.changeJson ?? null,
    },
  })
}

export function buildRegistrationStatusUpdateData(
  input: UpdateRegistrationStatusInput
): Record<string, unknown> {
  const updateData: Record<string, unknown> = {
    status: input.toStatus,
  }

  if (input.publicSafeMessage !== undefined) {
    updateData.publicSafeMessage = input.publicSafeMessage
  }

  if (input.internalReviewNotes !== undefined) {
    updateData.internalReviewNotes = input.internalReviewNotes
  }

  if (isApplicantDecisionStatus(input.toStatus)) {
    updateData.decidedById = input.actorId
    updateData.decidedAt = new Date()
  }

  return updateData
}

export function buildRegistrationAuditChangeJson(
  action: string,
  details: JsonObject = {}
): JsonObject {
  return {
    action,
    ...details,
  }
}

export function hasPublicSafeRegistrationBlockMessage(
  message: string | null | undefined
): boolean {
  return message === PUBLIC_SAFE_REGISTRATION_BLOCK_MESSAGE
}
