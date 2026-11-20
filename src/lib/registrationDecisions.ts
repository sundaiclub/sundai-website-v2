import prisma from '@/lib/prisma';
import { notifyEventDecision } from '@/lib/eventDecisionNotifications';
import { updateEventRegistrationStatus } from '@/lib/eventRegistrations';
import type {
  EntityId,
  JsonObject,
  RegistrationStatus,
} from '@/types/event-management';

const NOTIFIED_DECISION_STATUSES = [
  'APPROVED',
  'WAITLISTED',
  'DECLINED',
] as const;
type NotifiedDecisionStatus = (typeof NOTIFIED_DECISION_STATUSES)[number];

/** The most registrations one bulk decision request can change. */
export const MAX_BULK_DECISIONS = 100;
const BULK_DECISION_CONCURRENCY = 5;

function isNotifiedDecisionStatus(
  status: RegistrationStatus
): status is NotifiedDecisionStatus {
  return NOTIFIED_DECISION_STATUSES.some(candidate => candidate === status);
}

/**
 * Returns the event's default applicant message for a decision status, or
 * undefined when the status has no default message.
 */
export async function defaultDecisionMessage(
  eventId: EntityId,
  status: RegistrationStatus
): Promise<string | undefined> {
  if (!isNotifiedDecisionStatus(status)) return undefined;

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: {
      confirmationMessage: true,
      waitlistMessage: true,
      declineMessage: true,
    },
  });
  const messages: Record<NotifiedDecisionStatus, string | null | undefined> = {
    APPROVED: event?.confirmationMessage,
    WAITLISTED: event?.waitlistMessage,
    DECLINED: event?.declineMessage,
  };
  return messages[status] ?? undefined;
}

export type RegistrationStatusChange = {
  eventId: EntityId;
  registrationId: EntityId;
  actorId: EntityId;
  previousStatus: RegistrationStatus;
  toStatus: RegistrationStatus;
  publicSafeMessage?: string | null;
  internalReviewNotes?: string | null;
  changeJson?: JsonObject | null;
};

/**
 * Updates the registration status with an audit entry and notifies the
 * applicant when a decision status changed. Callers check permissions.
 */
export async function applyRegistrationStatusChange(
  change: RegistrationStatusChange
) {
  const registration = await updateEventRegistrationStatus({
    registrationId: change.registrationId,
    eventId: change.eventId,
    actorId: change.actorId,
    toStatus: change.toStatus,
    publicSafeMessage: change.publicSafeMessage,
    internalReviewNotes: change.internalReviewNotes,
    changeJson: change.changeJson ?? undefined,
  });
  if (!registration) return null;

  if (
    change.previousStatus !== change.toStatus &&
    isNotifiedDecisionStatus(change.toStatus)
  ) {
    await notifyEventDecision({
      eventId: change.eventId,
      registrationId: change.registrationId,
      status: change.toStatus,
    });
  }

  return registration;
}

/**
 * Applies one status to several registrations of an event. Each registration
 * gets its own audit entry and notification. Callers check permissions.
 */
export async function applyBulkRegistrationStatus(input: {
  eventId: EntityId;
  registrationIds: EntityId[];
  actorId: EntityId;
  toStatus: RegistrationStatus;
}): Promise<{ updatedIds: EntityId[]; failedIds: EntityId[] }> {
  const registrationIds = [...new Set(input.registrationIds)];
  const [existing, publicSafeMessage] = await Promise.all([
    prisma.eventRegistration.findMany({
      where: { id: { in: registrationIds }, eventId: input.eventId },
      select: { id: true, status: true },
    }),
    defaultDecisionMessage(input.eventId, input.toStatus),
  ]);
  const previousStatuses = new Map(
    existing.map(registration => [registration.id, registration.status])
  );

  const updatedIds: EntityId[] = [];
  const failedIds = registrationIds.filter(id => !previousStatuses.has(id));
  const pendingIds = registrationIds.filter(id => previousStatuses.has(id));

  for (
    let index = 0;
    index < pendingIds.length;
    index += BULK_DECISION_CONCURRENCY
  ) {
    const batch = pendingIds.slice(index, index + BULK_DECISION_CONCURRENCY);
    const results = await Promise.allSettled(
      batch.map(registrationId =>
        applyRegistrationStatusChange({
          eventId: input.eventId,
          registrationId,
          actorId: input.actorId,
          previousStatus: previousStatuses.get(registrationId)!,
          toStatus: input.toStatus,
          publicSafeMessage,
          changeJson: {
            action: 'BULK_UPDATE_REGISTRATION_STATUS',
            batchSize: registrationIds.length,
          },
        })
      )
    );
    results.forEach((result, resultIndex) => {
      const registrationId = batch[resultIndex];
      if (result.status === 'fulfilled' && result.value) {
        updatedIds.push(registrationId);
      } else {
        if (result.status === 'rejected') {
          console.error('[EVENT_REGISTRATION_BULK_DECISION]', result.reason);
        }
        failedIds.push(registrationId);
      }
    });
  }

  return { updatedIds, failedIds };
}
