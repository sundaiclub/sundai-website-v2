import type { Prisma } from '@prisma/client';

type EventStaffRegistrationClient = Pick<
  Prisma.TransactionClient,
  'eventRegistration' | 'eventRegistrationAudit'
>;

export async function approveEventStaffRegistrations(
  client: EventStaffRegistrationClient,
  input: {
    eventId: string;
    hackerIds: string[];
    actorId: string;
  }
) {
  const hackerIds = Array.from(new Set(input.hackerIds));

  await Promise.all(
    hackerIds.map(async hackerId => {
      const existing = await client.eventRegistration.findUnique({
        where: {
          eventId_hackerId: {
            eventId: input.eventId,
            hackerId,
          },
        },
        select: {
          id: true,
          status: true,
          cancelledAt: true,
        },
      });
      const decidedAt = new Date();
      const registration = await client.eventRegistration.upsert({
        where: {
          eventId_hackerId: {
            eventId: input.eventId,
            hackerId,
          },
        },
        create: {
          eventId: input.eventId,
          hackerId,
          status: 'APPROVED',
          source: 'INTERNAL',
          decidedById: input.actorId,
          decidedAt,
        },
        update: {
          status: 'APPROVED',
          decidedById: input.actorId,
          decidedAt,
          cancelledById: null,
          cancelledAt: null,
          waitlistedAt: null,
        },
        select: { id: true },
      });

      if (!existing || existing.status !== 'APPROVED' || existing.cancelledAt) {
        await client.eventRegistrationAudit.create({
          data: {
            registrationId: registration.id,
            eventId: input.eventId,
            actorId: input.actorId,
            fromStatus: existing?.status ?? null,
            toStatus: 'APPROVED',
            changeJson: {
              reason: 'EVENT_STAFF_ASSIGNED',
            },
          },
        });
      }
    })
  );
}
