const mockPrisma = {
  hacker: {
    findMany: jest.fn(),
    updateMany: jest.fn(),
  },
  chapterMembership: { updateMany: jest.fn() },
  smsPreferenceEvent: { create: jest.fn() },
  eventCommunicationRecipient: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  eventCommunication: { update: jest.fn() },
  eventPublicationNotificationRecipient: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
  },
  eventPublicationNotification: { update: jest.fn() },
  $transaction: jest.fn(),
};

const mockValidateRequest = jest.fn();

jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  default: mockPrisma,
}));

jest.mock('twilio', () => ({
  __esModule: true,
  default: { validateRequest: mockValidateRequest },
}));

const { POST: receiveIncoming } = require('../../src/app/api/webhooks/twilio/incoming/route');
const { POST: receiveStatus } = require('../../src/app/api/webhooks/twilio/status/route');

function twilioRequest(path: string, values: Record<string, string>) {
  return {
    url: `https://www.sundai.club${path}`,
    headers: new Headers({ 'x-twilio-signature': 'valid-signature' }),
    text: jest.fn().mockResolvedValue(new URLSearchParams(values).toString()),
  } as unknown as Request;
}

describe('Twilio messaging webhooks', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      TWILIO_AUTH_TOKEN: 'auth-token',
      TWILIO_WEBHOOK_BASE_URL: 'https://www.sundai.club',
    };
    mockValidateRequest.mockReturnValue(true);
    mockPrisma.$transaction.mockImplementation(async (callback: Function) =>
      callback(mockPrisma)
    );
    mockPrisma.eventPublicationNotificationRecipient.findFirst.mockResolvedValue(
      null
    );
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('rejects a request with an invalid Twilio signature', async () => {
    mockValidateRequest.mockReturnValue(false);
    const response = await receiveIncoming(
      twilioRequest('/api/webhooks/twilio/incoming', {
        MessageSid: 'SM-invalid',
        From: '+16175550123',
        OptOutType: 'STOP',
      })
    );

    expect(response.status).toBe(403);
    expect(mockPrisma.smsPreferenceEvent.create).not.toHaveBeenCalled();
  });

  it('records STOP and clears all SMS consent for the matching user', async () => {
    mockPrisma.hacker.findMany.mockResolvedValue([{ id: 'hacker-1' }]);
    const response = await receiveIncoming(
      twilioRequest('/api/webhooks/twilio/incoming', {
        MessageSid: 'SM-stop',
        From: '+16175550123',
        To: '+16175550999',
        Body: 'stop',
        OptOutType: 'STOP',
      })
    );

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toContain('<Response/>');
    expect(mockPrisma.smsPreferenceEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        providerSid: 'SM-stop',
        type: 'STOP',
        hackerId: 'hacker-1',
      }),
    });
    expect(mockPrisma.hacker.findMany).toHaveBeenCalledWith({
      where: {
        phoneNumber: {
          in: ['+16175550123', '16175550123', '6175550123'],
        },
      },
      select: { id: true },
    });
    expect(mockPrisma.hacker.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['hacker-1'] } },
      data: { smsConsentAt: null, smsConsentVersion: null },
    });
    expect(mockPrisma.chapterMembership.updateMany).toHaveBeenCalledWith({
      where: { hackerId: { in: ['hacker-1'] } },
      data: {
        smsNotificationsEnabled: false,
        smsConsentAt: null,
        smsConsentVersion: null,
      },
    });
  });

  it('records HELP without changing consent', async () => {
    mockPrisma.hacker.findMany.mockResolvedValue([{ id: 'hacker-1' }]);
    const response = await receiveIncoming(
      twilioRequest('/api/webhooks/twilio/incoming', {
        MessageSid: 'SM-help',
        From: '+16175550123',
        OptOutType: 'HELP',
      })
    );

    expect(response.status).toBe(200);
    expect(mockPrisma.smsPreferenceEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: 'HELP' }),
    });
    expect(mockPrisma.hacker.updateMany).not.toHaveBeenCalled();
    expect(mockPrisma.chapterMembership.updateMany).not.toHaveBeenCalled();
  });

  it('updates a communication recipient from a delivery callback', async () => {
    mockPrisma.eventCommunicationRecipient.findFirst.mockResolvedValue({
      id: 'recipient-1',
      communicationId: 'communication-1',
      status: 'SENT',
    });
    mockPrisma.eventCommunicationRecipient.findMany.mockResolvedValue([
      { status: 'DELIVERED' },
      { status: 'UNDELIVERED' },
    ]);

    const response = await receiveStatus(
      twilioRequest('/api/webhooks/twilio/status', {
        MessageSid: 'SM-delivered',
        MessageStatus: 'delivered',
      })
    );

    expect(response.status).toBe(204);
    expect(mockPrisma.eventCommunicationRecipient.update).toHaveBeenCalledWith({
      where: { id: 'recipient-1' },
      data: expect.objectContaining({ status: 'DELIVERED' }),
    });
    expect(mockPrisma.eventCommunication.update).toHaveBeenCalledWith({
      where: { id: 'communication-1' },
      data: {
        sentCount: 1,
        failedCount: 1,
        status: 'PARTIAL',
      },
    });
  });
});
