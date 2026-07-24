import { createHash } from 'crypto';
import type { PrismaClient } from '@prisma/client';
import prisma from '@/lib/prisma';
import { SITE_APPLICATION_SMS_CONSENT_VERSION } from '@/lib/smsConsent';
import type {
  EventCommunicationAudience,
  EventCommunicationChannel,
} from '@/types/event-workspace';

export const EVENT_COMMUNICATION_AUDIENCES = [
  'ACTIVE_REGISTERED',
  'PENDING',
  'APPROVED',
  'WAITLISTED',
  'DECLINED',
  'SELECTED',
] as const;

export const EVENT_COMMUNICATION_STATUS_AUDIENCES = [
  'PENDING',
  'APPROVED',
  'WAITLISTED',
  'DECLINED',
] as const;

export type EventCommunicationMaterialReference = {
  kind: 'EVENT_MATERIAL';
  materialId: string;
};

type ReferencedEventMaterial = {
  id: string;
  visibility: 'PUBLIC' | 'APPROVED_ATTENDEES' | 'ORGANIZERS_ONLY';
  removedAt?: Date | string | null;
};

type AudienceRegistration = {
  id: string;
  status: string;
  cancelledAt?: Date | string | null;
  hacker: {
    id: string;
    name: string;
    email?: string | null;
    phoneNumber?: string | null;
    smsConsentAt?: Date | string | null;
    smsConsentVersion?: string | null;
    isGloballyBanned?: boolean;
  };
  membership?: {
    status?: string;
    notificationsAllowed?: boolean;
    emailNotificationsEnabled?: boolean;
    smsNotificationsEnabled?: boolean;
    smsConsentAt?: Date | string | null;
    smsConsentVersion?: string | null;
  } | null;
};

export type ResolvedCommunicationRecipient = {
  hackerId: string;
  registrationId: string;
  contactValue: string;
  displayName: string;
};

export type CommunicationAudienceResolution = {
  recipients: ResolvedCommunicationRecipient[];
  exclusions: {
    cancelled: number;
    missingContact: number;
    preferenceDisabled: number;
    ineligible: number;
  };
};

function isAudienceStatus(
  status: string,
  audienceType: EventCommunicationAudience,
  audienceTypes: EventCommunicationAudience[],
  selected: Set<string>,
  hackerId: string
): boolean {
  if (audienceTypes.length > 0) {
    return audienceTypes.some(type =>
      isAudienceStatus(status, type, [], selected, hackerId)
    );
  }
  if (audienceType === 'SELECTED') return selected.has(hackerId);
  if (audienceType === 'ACTIVE_REGISTERED') {
    return ['PENDING', 'APPROVED', 'WAITLISTED'].includes(status);
  }
  return status === audienceType;
}

function usableEmail(value: string | null | undefined) {
  return !!value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function usableE164(value: string | null | undefined) {
  return !!value && /^\+[1-9]\d{7,14}$/.test(value);
}

export function resolveEventCommunicationAudience({
  registrations,
  audienceType,
  audienceTypes = [],
  selectedHackerIds = [],
  channel,
}: {
  registrations: AudienceRegistration[];
  audienceType: EventCommunicationAudience;
  audienceTypes?: EventCommunicationAudience[];
  selectedHackerIds?: string[];
  channel: EventCommunicationChannel;
}): CommunicationAudienceResolution {
  if (!EVENT_COMMUNICATION_AUDIENCES.includes(audienceType)) {
    throw new Error('Unsupported communication audience.');
  }

  const selected = new Set(selectedHackerIds);
  const recipients: ResolvedCommunicationRecipient[] = [];
  const exclusions = {
    cancelled: 0,
    missingContact: 0,
    preferenceDisabled: 0,
    ineligible: 0,
  };

  for (const registration of registrations) {
    if (registration.cancelledAt || registration.status === 'CANCELLED') {
      exclusions.cancelled += 1;
      continue;
    }
    if (
      !isAudienceStatus(
        registration.status,
        audienceType,
        audienceTypes,
        selected,
        registration.hacker.id
      )
    ) {
      continue;
    }
    if (registration.hacker.isGloballyBanned) {
      exclusions.ineligible += 1;
      continue;
    }

    let contactValue: string | null | undefined;
    if (channel === 'EMAIL') {
      const membership = registration.membership;
      if (!membership || membership.status !== 'ACTIVE') {
        exclusions.ineligible += 1;
        continue;
      }
      if (!membership.notificationsAllowed) {
        exclusions.preferenceDisabled += 1;
        continue;
      }
      contactValue = registration.hacker.email;
      if (!usableEmail(contactValue)) {
        exclusions.missingContact += 1;
        continue;
      }
      if (!membership.emailNotificationsEnabled) {
        exclusions.preferenceDisabled += 1;
        continue;
      }
    } else {
      if (registration.membership?.notificationsAllowed === false) {
        exclusions.preferenceDisabled += 1;
        continue;
      }
      contactValue = registration.hacker.phoneNumber;
      if (!usableE164(contactValue)) {
        exclusions.missingContact += 1;
        continue;
      }
      if (
        !registration.hacker.smsConsentAt ||
        registration.hacker.smsConsentVersion !==
          SITE_APPLICATION_SMS_CONSENT_VERSION
      ) {
        exclusions.ineligible += 1;
        continue;
      }
    }

    recipients.push({
      hackerId: registration.hacker.id,
      registrationId: registration.id,
      contactValue: contactValue!,
      displayName: registration.hacker.name,
    });
  }

  recipients.sort((left, right) => left.hackerId.localeCompare(right.hackerId));
  return { recipients, exclusions };
}

export function fingerprintEventCommunicationAudience({
  channel,
  audienceType,
  audienceTypes = [],
  recipients,
}: {
  channel: EventCommunicationChannel;
  audienceType: EventCommunicationAudience;
  audienceTypes?: EventCommunicationAudience[];
  recipients: Array<
    Pick<
      ResolvedCommunicationRecipient,
      'hackerId' | 'registrationId' | 'contactValue'
    >
  >;
}) {
  const canonical = [...recipients]
    .sort((left, right) =>
      `${left.hackerId}\0${left.registrationId}`.localeCompare(
        `${right.hackerId}\0${right.registrationId}`
      )
    )
    .map(recipient => [
      recipient.hackerId,
      recipient.registrationId,
      recipient.contactValue,
    ]);
  const digest = createHash('sha256')
    .update(
      JSON.stringify({
        channel,
        audienceType,
        audienceTypes: [...audienceTypes].sort(),
        recipients: canonical,
      })
    )
    .digest('hex');
  return `sha256:${digest}`;
}

export function validateEventCommunicationDraft(input: {
  channel: unknown;
  audienceType: unknown;
  subject?: unknown;
  body: unknown;
  audienceDefinition?: unknown;
}) {
  const errors: Record<string, string> = {};
  if (input.channel !== 'EMAIL' && input.channel !== 'SMS') {
    errors.channel = 'Channel must be EMAIL or SMS.';
  }
  if (
    typeof input.audienceType !== 'string' ||
    !EVENT_COMMUNICATION_AUDIENCES.includes(
      input.audienceType as EventCommunicationAudience
    )
  ) {
    errors.audienceType = 'Audience is not supported.';
  }
  if (
    input.audienceDefinition &&
    typeof input.audienceDefinition === 'object' &&
    'statuses' in input.audienceDefinition
  ) {
    const statuses = (input.audienceDefinition as { statuses?: unknown })
      .statuses;
    if (
      !Array.isArray(statuses) ||
      statuses.length === 0 ||
      statuses.some(
        status =>
          typeof status !== 'string' ||
          !EVENT_COMMUNICATION_STATUS_AUDIENCES.includes(
            status as (typeof EVENT_COMMUNICATION_STATUS_AUDIENCES)[number]
          )
      )
    ) {
      errors.audienceDefinition =
        'Audience statuses must include at least one supported registration status.';
    }
  }
  if (typeof input.body !== 'string' || !input.body.trim()) {
    errors.body = 'Message body is required.';
  }
  if (
    input.channel === 'EMAIL' &&
    (typeof input.subject !== 'string' || !input.subject.trim())
  ) {
    errors.subject = 'Email subject is required.';
  }
  if (
    input.channel === 'SMS' &&
    input.subject !== undefined &&
    input.subject !== null &&
    input.subject !== ''
  ) {
    errors.subject = 'SMS messages do not have a subject.';
  }
  if (
    input.audienceType === 'SELECTED' &&
    (!input.audienceDefinition ||
      typeof input.audienceDefinition !== 'object' ||
      !Array.isArray(
        (input.audienceDefinition as { hackerIds?: unknown }).hackerIds
      ))
  ) {
    errors.audienceDefinition = 'Selected audiences require hackerIds.';
  }
  return { valid: Object.keys(errors).length === 0, errors };
}

export function validateEventCommunicationMaterialReferences({
  references,
  materials,
  audienceType,
}: {
  references: unknown;
  materials: ReferencedEventMaterial[];
  audienceType: EventCommunicationAudience;
}): {
  valid: boolean;
  references: EventCommunicationMaterialReference[];
  errors: Record<string, string>;
} {
  const errors: Record<string, string> = {};
  if (!Array.isArray(references)) {
    return {
      valid: false,
      references: [],
      errors: { references: 'Material references must be an array.' },
    };
  }

  const materialsById = new Map(
    materials.map(material => [material.id, material])
  );
  const parsed: EventCommunicationMaterialReference[] = [];
  references.forEach((reference, index) => {
    const key = `references.${index}`;
    if (
      !reference ||
      typeof reference !== 'object' ||
      Array.isArray(reference) ||
      (reference as { kind?: unknown }).kind !== 'EVENT_MATERIAL' ||
      typeof (reference as { materialId?: unknown }).materialId !== 'string' ||
      !(reference as { materialId: string }).materialId.trim() ||
      Object.keys(reference).some(
        field => !['kind', 'materialId'].includes(field)
      )
    ) {
      errors[key] =
        'Material references require only kind EVENT_MATERIAL and materialId.';
      return;
    }

    const materialId = (reference as { materialId: string }).materialId.trim();
    const material = materialsById.get(materialId);
    if (!material || material.removedAt) {
      errors[key] = 'Referenced material is unavailable.';
      return;
    }
    if (material.visibility === 'ORGANIZERS_ONLY') {
      errors[key] = 'Organizer-only materials cannot be message attachments.';
      return;
    }
    if (
      material.visibility === 'APPROVED_ATTENDEES' &&
      audienceType !== 'APPROVED'
    ) {
      errors[key] =
        'Approved-attendee materials require an approved-only audience.';
      return;
    }
    parsed.push({ kind: 'EVENT_MATERIAL', materialId });
  });

  return {
    valid: Object.keys(errors).length === 0,
    references: parsed,
    errors,
  };
}

export function getEventCommunicationProviderAvailability(
  env: Record<string, string | undefined> = process.env
) {
  const email = !!env.AWS_REGION && !!env.AWS_SES_FROM_EMAIL;
  const smsProvider =
    !!env.TWILIO_ACCOUNT_SID &&
    !!env.TWILIO_AUTH_TOKEN &&
    !!env.TWILIO_MESSAGING_SERVICE_SID;
  return {
    email: {
      available: email,
      reason: email ? null : 'AWS SES is not configured.',
    },
    sms: {
      available: smsProvider,
      reason: smsProvider ? null : 'Twilio is not configured.',
    },
  };
}

export function aggregateCommunicationFinalState(
  outcomes: Array<{ status: 'SENT' | 'FAILED' }>
): {
  status: 'SENT' | 'FAILED' | 'PARTIAL';
  recipientCount: number;
  sentCount: number;
  failedCount: number;
} {
  const sentCount = outcomes.filter(
    outcome => outcome.status === 'SENT'
  ).length;
  const failedCount = outcomes.length - sentCount;
  const status =
    failedCount === 0 ? 'SENT' : sentCount === 0 ? 'FAILED' : 'PARTIAL';
  return { status, recipientCount: outcomes.length, sentCount, failedCount };
}

export async function snapshotEventCommunicationAudience({
  db = prisma,
  communicationId,
  senderId,
  audience,
  previewFingerprint,
}: {
  db?: Pick<PrismaClient, '$transaction'>;
  communicationId: string;
  senderId: string;
  audience: CommunicationAudienceResolution;
  previewFingerprint: string;
}) {
  return db.$transaction(async tx => {
    const transitioned = await tx.eventCommunication.updateMany({
      where: { id: communicationId, status: 'DRAFT' },
      data: {
        status: 'SENDING',
        sentById: senderId,
        previewFingerprint,
        recipientCount: audience.recipients.length,
        sentCount: 0,
        failedCount: 0,
      },
    });
    if (transitioned.count !== 1) {
      throw new Error('Communication is no longer an editable draft.');
    }
    if (audience.recipients.length > 0) {
      await tx.eventCommunicationRecipient.createMany({
        data: audience.recipients.map(recipient => ({
          communicationId,
          ...recipient,
          status: 'PENDING',
        })),
      });
    }
    return tx.eventCommunication.findUnique({
      where: { id: communicationId },
      // Delivery needs every snapshotted recipient, but not their relations or
      // provider/audit metadata. Keep the relation projection narrow.
      select: {
        id: true,
        recipients: {
          select: { id: true, contactValue: true },
          orderBy: { hackerId: 'asc' },
        },
      },
    });
  });
}

export async function finalizeEventCommunication({
  db = prisma,
  communicationId,
  outcomes,
}: {
  db?: Pick<PrismaClient, '$transaction'>;
  communicationId: string;
  outcomes: Array<{
    recipientId: string;
    status: 'SENT' | 'FAILED';
    providerMessageId?: string | null;
    errorCode?: string | null;
    errorMessage?: string | null;
    attemptedAt?: Date;
    deliveredAt?: Date | null;
  }>;
}) {
  const aggregate = aggregateCommunicationFinalState(outcomes);
  return db.$transaction(async tx => {
    for (const outcome of outcomes) {
      await tx.eventCommunicationRecipient.update({
        where: { id: outcome.recipientId },
        data: {
          status: outcome.status,
          providerMessageId: outcome.providerMessageId ?? null,
          errorCode: outcome.errorCode ?? null,
          errorMessage: outcome.errorMessage ?? null,
          attemptedAt: outcome.attemptedAt ?? new Date(),
          deliveredAt:
            outcome.status === 'SENT'
              ? (outcome.deliveredAt ?? new Date())
              : null,
        },
      });
    }
    return tx.eventCommunication.update({
      where: { id: communicationId, status: 'SENDING' },
      data: { ...aggregate, sentAt: new Date() },
    });
  });
}
