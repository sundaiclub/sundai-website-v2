import prisma from '@/lib/prisma';
import {
  finalizeEventCommunication,
  resolveCurrentEventCommunicationAudience,
  snapshotEventCommunicationAudience,
} from '@/lib/eventCommunications';
import {
  deliverEventSmsRecipients,
  getEventDeliveryAvailability,
} from '@/lib/eventDelivery';
import { publishEmailBatches } from '@/lib/emailQueue';
import { sendCheckInTickets } from '@/lib/eventCheckInTickets';

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    event: { findUnique: jest.fn() },
    eventRegistration: { findMany: jest.fn() },
    eventCommunication: { create: jest.fn() },
    emailDeliveryBatch: { findMany: jest.fn() },
  },
}));

jest.mock('@/lib/eventCommunications', () => ({
  ...jest.requireActual('@/lib/eventCommunications'),
  resolveCurrentEventCommunicationAudience: jest.fn(),
  snapshotEventCommunicationAudience: jest.fn(),
  finalizeEventCommunication: jest.fn(),
}));

jest.mock('@/lib/eventDelivery', () => ({
  deliverEventSmsRecipients: jest.fn(),
  getEventDeliveryAvailability: jest.fn(),
}));

jest.mock('@/lib/emailQueue', () => ({ publishEmailBatches: jest.fn() }));

const db = prisma as unknown as {
  event: { findUnique: jest.Mock };
  eventRegistration: { findMany: jest.Mock };
  eventCommunication: { create: jest.Mock };
  emailDeliveryBatch: { findMany: jest.Mock };
};
const mockResolveAudience =
  resolveCurrentEventCommunicationAudience as jest.Mock;
const mockSnapshot = snapshotEventCommunicationAudience as jest.Mock;

const adaToken = '11111111-1111-4111-8111-111111111111';
const event = {
  id: 'event-1',
  title: 'AI Build Night',
  slug: 'ai-build-night',
  chapterId: 'chapter-boston',
  startTime: new Date('2026-07-18T14:00:00.000Z'),
  endTime: new Date('2026-07-18T22:00:00.000Z'),
  approvedDetailsJson: null,
  chapter: { slug: 'boston' },
};
const now = new Date('2026-07-10T12:00:00.000Z');

function audience(contactValue: string) {
  return {
    recipients: [
      {
        hackerId: 'hacker-ada',
        registrationId: 'registration-ada',
        contactValue,
        displayName: 'Ada Lovelace',
      },
    ],
    exclusions: {
      cancelled: 0,
      missingContact: 0,
      preferenceDisabled: 0,
      ineligible: 0,
    },
  };
}

beforeEach(() => {
  jest.resetAllMocks();
  db.event.findUnique.mockResolvedValue(event);
  db.eventRegistration.findMany.mockResolvedValue([
    { id: 'registration-ada', checkInToken: adaToken },
  ]);
  db.eventCommunication.create.mockImplementation(({ data }) => ({
    id: `communication-${data.channel.toLowerCase()}`,
  }));
  db.emailDeliveryBatch.findMany.mockResolvedValue([{ id: 'batch-1' }]);
  (getEventDeliveryAvailability as jest.Mock).mockReturnValue({
    email: true,
    sms: true,
  });
  mockResolveAudience.mockImplementation(({ channel }) =>
    audience(channel === 'EMAIL' ? 'ada@example.com' : '+16175550123')
  );
  mockSnapshot.mockImplementation(({ communicationId }) => ({
    id: communicationId,
    recipients: [
      {
        id: `${communicationId}-recipient`,
        contactValue: communicationId.endsWith('email')
          ? 'ada@example.com'
          : '+16175550123',
        registrationId: 'registration-ada',
        displayName: 'Ada Lovelace',
      },
    ],
  }));
  (deliverEventSmsRecipients as jest.Mock).mockResolvedValue([
    { recipientId: 'communication-sms-recipient', status: 'SENT' },
  ]);
});

describe('sendCheckInTickets', () => {
  it('records each channel as an approved-attendee communication', async () => {
    await sendCheckInTickets({ eventId: 'event-1', actorId: 'hacker-mc', now });

    expect(mockResolveAudience).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: 'event-1',
        chapterId: 'chapter-boston',
        audienceType: 'APPROVED',
        channel: 'EMAIL',
      })
    );
    expect(db.eventCommunication.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventId: 'event-1',
        createdById: 'hacker-mc',
        channel: 'EMAIL',
        subject: 'Your check-in QR code for AI Build Night',
        audienceType: 'APPROVED',
      }),
      select: { id: true },
    });
    expect(db.eventCommunication.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ channel: 'SMS', subject: null }),
      })
    );
  });

  it('queues personalized QR emails for background delivery', async () => {
    await sendCheckInTickets({ eventId: 'event-1', actorId: 'hacker-mc', now });

    const emailSnapshot = mockSnapshot.mock.calls.find(
      ([input]) => input.communicationId === 'communication-email'
    )![0];
    const content = emailSnapshot.emailContent({
      id: 'recipient-1',
      contactValue: 'ada@example.com',
      registrationId: 'registration-ada',
      displayName: 'Ada Lovelace',
    });
    expect(content.body).toContain('Hi Ada Lovelace,');
    expect(content.html).toContain(`/api/qr/check-in/${adaToken}`);
    expect(publishEmailBatches).toHaveBeenCalledWith(['batch-1']);
  });

  it('sends SMS through the shared delivery path and records outcomes', async () => {
    await sendCheckInTickets({ eventId: 'event-1', actorId: 'hacker-mc', now });

    expect(deliverEventSmsRecipients).toHaveBeenCalledWith({
      body: expect.stringContaining('/events/boston/ai-build-night?tab=ticket'),
      recipients: [
        {
          recipientId: 'communication-sms-recipient',
          contactValue: '+16175550123',
        },
      ],
    });
    expect(finalizeEventCommunication).toHaveBeenCalledWith({
      communicationId: 'communication-sms',
      outcomes: [
        { recipientId: 'communication-sms-recipient', status: 'SENT' },
      ],
    });
  });

  it('skips channels with nobody eligible and unconfigured providers', async () => {
    (getEventDeliveryAvailability as jest.Mock).mockReturnValue({
      email: true,
      sms: false,
    });
    mockResolveAudience.mockResolvedValue({
      ...audience('ada@example.com'),
      recipients: [],
    });

    await sendCheckInTickets({ eventId: 'event-1', actorId: 'hacker-mc', now });

    expect(mockResolveAudience).toHaveBeenCalledTimes(1);
    expect(db.eventCommunication.create).not.toHaveBeenCalled();
  });

  it('does nothing once the check-in window has closed', async () => {
    await sendCheckInTickets({
      eventId: 'event-1',
      actorId: 'hacker-mc',
      now: new Date('2026-07-19T22:00:01.000Z'),
    });

    expect(db.eventRegistration.findMany).not.toHaveBeenCalled();
    expect(db.eventCommunication.create).not.toHaveBeenCalled();
  });

  it('keeps sending SMS when the email queue fails', async () => {
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    (publishEmailBatches as jest.Mock).mockRejectedValue(
      new Error('queue down')
    );

    await sendCheckInTickets({ eventId: 'event-1', actorId: 'hacker-mc', now });

    expect(deliverEventSmsRecipients).toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith(
      '[CHECK_IN_TICKETS_EMAIL]',
      expect.any(Error)
    );
    consoleError.mockRestore();
  });
});
