type AudienceType =
  | 'ACTIVE_REGISTERED'
  | 'PENDING'
  | 'APPROVED'
  | 'WAITLISTED'
  | 'DECLINED'
  | 'SELECTED';

type Registration = ReturnType<typeof registration>;

type EventCommunicationsModule = {
  resolveEventCommunicationAudience: (input: {
    registrations: Registration[];
    audienceType: AudienceType;
    audienceTypes?: AudienceType[];
    selectedHackerIds?: string[];
    channel: 'EMAIL' | 'SMS';
    smsConsentVersion?: string;
  }) => {
    recipients: Array<{
      hackerId: string;
      registrationId: string;
      contactValue: string;
      displayName: string;
    }>;
    exclusions: {
      cancelled: number;
      missingContact: number;
      preferenceDisabled: number;
      ineligible: number;
    };
  };
  fingerprintEventCommunicationAudience: (input: {
    channel: 'EMAIL' | 'SMS';
    audienceType: AudienceType;
    recipients: Array<{
      hackerId: string;
      registrationId: string;
      contactValue: string;
    }>;
  }) => string;
  validateEventCommunicationMaterialReferences: (input: {
    references: unknown;
    materials: Array<{
      id: string;
      visibility: 'PUBLIC' | 'APPROVED_ATTENDEES' | 'ORGANIZERS_ONLY';
      removedAt?: Date | string | null;
    }>;
    audienceType: AudienceType;
  }) => {
    valid: boolean;
    references: Array<{ kind: 'EVENT_MATERIAL'; materialId: string }>;
    errors: Record<string, string>;
  };
};

const loadEventCommunications = (): EventCommunicationsModule => {
  try {
    return require('../../src/lib/eventCommunications') as EventCommunicationsModule;
  } catch (error) {
    throw new Error(
      `Expected the event-communications domain module for T044. ${String(
        error
      )}`
    );
  }
};

function registration(overrides: Record<string, unknown> = {}) {
  return {
    id: 'registration-approved',
    status: 'APPROVED',
    cancelledAt: null,
    hacker: {
      id: 'hacker-approved',
      name: 'Approved Hacker',
      email: 'approved@example.com',
      phoneNumber: '+16175550100',
      smsConsentAt: new Date('2026-07-01T12:00:00.000Z'),
      smsConsentVersion: 'site-application-checkbox-2026-08-04',
      isGloballyBanned: false,
    },
    membership: {
      status: 'ACTIVE',
      notificationsAllowed: true,
      emailNotificationsEnabled: true,
      smsNotificationsEnabled: true,
      smsConsentAt: new Date('2026-07-01T12:00:00.000Z'),
      smsConsentVersion: 'site-application-checkbox-2026-08-04',
    },
    ...overrides,
  } as any;
}

const resolve = (
  registrations: Registration[],
  overrides: Record<string, unknown> = {}
) =>
  loadEventCommunications().resolveEventCommunicationAudience({
    registrations,
    audienceType: 'APPROVED',
    channel: 'EMAIL',
    smsConsentVersion: 'sms-consent-v1',
    ...overrides,
  } as any);

describe('event communication audience resolution', () => {
  it.each([
    ['PENDING', 'PENDING'],
    ['APPROVED', 'APPROVED'],
    ['WAITLISTED', 'WAITLISTED'],
    ['DECLINED', 'DECLINED'],
  ] as const)(
    'selects only current %s registrations',
    (audienceType, status) => {
      const rows = [
        registration({
          id: `registration-${status.toLowerCase()}`,
          status,
          hacker: {
            ...registration().hacker,
            id: `hacker-${status.toLowerCase()}`,
          },
        }),
        registration({
          id: 'registration-other',
          status: status === 'APPROVED' ? 'PENDING' : 'APPROVED',
          hacker: { ...registration().hacker, id: 'hacker-other' },
        }),
      ];

      const audience = resolve(rows, { audienceType });
      expect(audience.recipients.map(row => row.hackerId)).toEqual([
        `hacker-${status.toLowerCase()}`,
      ]);
    }
  );

  it('defines ACTIVE_REGISTERED as current pending, approved, and waitlisted registrations', () => {
    const rows = ['PENDING', 'APPROVED', 'WAITLISTED', 'DECLINED'].map(status =>
      registration({
        id: `registration-${status.toLowerCase()}`,
        status,
        hacker: {
          ...registration().hacker,
          id: `hacker-${status.toLowerCase()}`,
        },
      })
    );

    const audience = resolve(rows, { audienceType: 'ACTIVE_REGISTERED' });
    expect(audience.recipients.map(row => row.hackerId).sort()).toEqual([
      'hacker-approved',
      'hacker-pending',
      'hacker-waitlisted',
    ]);
  });

  it('combines selected registration-status audiences without duplicating recipients', () => {
    const rows = ['PENDING', 'APPROVED', 'WAITLISTED', 'DECLINED'].map(status =>
      registration({
        id: `registration-${status.toLowerCase()}`,
        status,
        hacker: {
          ...registration().hacker,
          id: `hacker-${status.toLowerCase()}`,
        },
      })
    );

    const audience = resolve(rows, {
      audienceType: 'PENDING',
      audienceTypes: ['PENDING', 'WAITLISTED', 'DECLINED'],
    });

    expect(audience.recipients.map(row => row.hackerId).sort()).toEqual([
      'hacker-declined',
      'hacker-pending',
      'hacker-waitlisted',
    ]);
  });

  it('restricts SELECTED to the requested current registration hackers', () => {
    const rows = [
      registration(),
      registration({
        id: 'registration-second',
        hacker: { ...registration().hacker, id: 'hacker-second' },
      }),
    ];

    const audience = resolve(rows, {
      audienceType: 'SELECTED',
      selectedHackerIds: ['hacker-second', 'hacker-not-registered'],
    });
    expect(audience.recipients.map(row => row.hackerId)).toEqual([
      'hacker-second',
    ]);
  });

  it('excludes cancelled rows even if their status otherwise matches', () => {
    const audience = resolve([
      registration(),
      registration({
        id: 'registration-cancelled',
        cancelledAt: new Date('2026-07-09T12:00:00.000Z'),
        hacker: { ...registration().hacker, id: 'hacker-cancelled' },
      }),
      registration({
        id: 'registration-cancelled-status',
        status: 'CANCELLED',
        hacker: { ...registration().hacker, id: 'hacker-cancelled-status' },
      }),
    ]);

    expect(audience.recipients.map(row => row.hackerId)).toEqual([
      'hacker-approved',
    ]);
    expect(audience.exclusions.cancelled).toBe(2);
  });

  it('requires usable contact values and enabled master/channel email preferences', () => {
    const audience = resolve([
      registration(),
      registration({
        id: 'registration-no-email',
        hacker: {
          ...registration().hacker,
          id: 'hacker-no-email',
          email: null,
        },
      }),
      registration({
        id: 'registration-master-off',
        hacker: { ...registration().hacker, id: 'hacker-master-off' },
        membership: {
          ...registration().membership,
          notificationsAllowed: false,
        },
      }),
      registration({
        id: 'registration-email-off',
        hacker: { ...registration().hacker, id: 'hacker-email-off' },
        membership: {
          ...registration().membership,
          emailNotificationsEnabled: false,
        },
      }),
    ]);

    expect(audience.recipients).toHaveLength(1);
    expect(audience.exclusions).toMatchObject({
      missingContact: 1,
      preferenceDisabled: 2,
    });
  });

  it('normalizes US contacts and requires consent matching the configured SMS version', () => {
    const rows = [
      registration(),
      registration({
        id: 'registration-us-phone',
        hacker: {
          ...registration().hacker,
          id: 'hacker-us-phone',
          phoneNumber: '5086485700',
        },
      }),
      registration({
        id: 'registration-bad-phone',
        hacker: {
          ...registration().hacker,
          id: 'hacker-bad-phone',
          phoneNumber: '555-0101',
        },
      }),
      registration({
        id: 'registration-no-consent',
        hacker: {
          ...registration().hacker,
          id: 'hacker-no-consent',
        },
        membership: {
          ...registration().membership,
          smsConsentAt: null,
        },
      }),
      registration({
        id: 'registration-old-consent',
        hacker: {
          ...registration().hacker,
          id: 'hacker-old-consent',
        },
        membership: {
          ...registration().membership,
          smsConsentVersion: 'sms-consent-v0',
        },
      }),
    ];

    const audience = resolve(rows, { channel: 'SMS' });
    expect(audience.recipients.map(row => row.hackerId)).toEqual([
      'hacker-approved',
      'hacker-us-phone',
    ]);
    expect(audience.recipients[1].contactValue).toBe('+15086485700');
    expect(audience.exclusions).toMatchObject({
      missingContact: 1,
      ineligible: 2,
    });
  });

  it('excludes SMS recipients who disabled SMS in chapter preferences', () => {
    const audience = resolve(
      [
        registration({
          membership: {
            ...registration().membership,
            smsNotificationsEnabled: false,
          },
        }),
      ],
      { channel: 'SMS' }
    );

    expect(audience.recipients).toHaveLength(0);
    expect(audience.exclusions.preferenceDisabled).toBe(1);
  });

  it('folds globally banned recipients into neutral ineligible results without ban metadata', () => {
    const audience = resolve([
      registration(),
      registration({
        id: 'registration-hidden',
        hacker: {
          ...registration().hacker,
          id: 'hacker-hidden',
          isGloballyBanned: true,
          banReason: 'private moderation reason',
        },
      }),
    ]);
    const serialized = JSON.stringify(audience);

    expect(audience.recipients.map(row => row.hackerId)).toEqual([
      'hacker-approved',
    ]);
    expect(audience.exclusions.ineligible).toBe(1);
    expect(serialized).not.toMatch(/ban|moderation|private moderation reason/i);
  });

  it('creates deterministic fingerprints independent of recipient query order', () => {
    const { fingerprintEventCommunicationAudience } = loadEventCommunications();
    const recipients = [
      {
        hackerId: 'hacker-b',
        registrationId: 'registration-b',
        contactValue: 'b@example.com',
      },
      {
        hackerId: 'hacker-a',
        registrationId: 'registration-a',
        contactValue: 'a@example.com',
      },
    ];
    const input = {
      channel: 'EMAIL' as const,
      audienceType: 'APPROVED' as const,
    };

    const first = fingerprintEventCommunicationAudience({
      ...input,
      recipients,
    });
    const reordered = fingerprintEventCommunicationAudience({
      ...input,
      recipients: [...recipients].reverse(),
    });
    const changed = fingerprintEventCommunicationAudience({
      ...input,
      recipients: [{ ...recipients[0], contactValue: 'new@example.com' }],
    });

    expect(first).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(reordered).toBe(first);
    expect(changed).not.toBe(first);
  });
});

describe('event communication material references', () => {
  const materials = [
    { id: 'material-public', visibility: 'PUBLIC' as const },
    {
      id: 'material-approved',
      visibility: 'APPROVED_ATTENDEES' as const,
    },
    {
      id: 'material-organizers',
      visibility: 'ORGANIZERS_ONLY' as const,
    },
  ];

  it('accepts only structured public material references without embedding links', () => {
    const result =
      loadEventCommunications().validateEventCommunicationMaterialReferences({
        references: [{ kind: 'EVENT_MATERIAL', materialId: 'material-public' }],
        materials,
        audienceType: 'ACTIVE_REGISTERED',
      });

    expect(result).toEqual({
      valid: true,
      references: [{ kind: 'EVENT_MATERIAL', materialId: 'material-public' }],
      errors: {},
    });
    expect(JSON.stringify(result.references)).not.toMatch(/url|storage|href/i);
  });

  it('rejects organizer-only materials instead of creating public attachments', () => {
    const result =
      loadEventCommunications().validateEventCommunicationMaterialReferences({
        references: [
          { kind: 'EVENT_MATERIAL', materialId: 'material-organizers' },
        ],
        materials,
        audienceType: 'APPROVED',
      });

    expect(result.valid).toBe(false);
    expect(result.references).toEqual([]);
    expect(result.errors['references.0']).toMatch(/organizer-only/i);
  });

  it('keeps approved-attendee material links gated to approved-only audiences', () => {
    const validate =
      loadEventCommunications().validateEventCommunicationMaterialReferences;
    const protectedReference = [
      { kind: 'EVENT_MATERIAL', materialId: 'material-approved' },
    ];

    expect(
      validate({
        references: protectedReference,
        materials,
        audienceType: 'ACTIVE_REGISTERED',
      }).valid
    ).toBe(false);
    expect(
      validate({
        references: protectedReference,
        materials,
        audienceType: 'APPROVED',
      })
    ).toEqual({
      valid: true,
      references: protectedReference,
      errors: {},
    });
  });

  it('rejects raw URLs, storage keys, unknown, and removed material references', () => {
    const validate =
      loadEventCommunications().validateEventCommunicationMaterialReferences;
    const result = validate({
      references: [
        {
          kind: 'EVENT_MATERIAL',
          materialId: 'material-public',
          url: 'https://private.example/material',
        },
        { kind: 'EVENT_MATERIAL', materialId: 'missing-material' },
        { kind: 'EVENT_MATERIAL', materialId: 'removed-material' },
      ],
      materials: [
        ...materials,
        {
          id: 'removed-material',
          visibility: 'PUBLIC',
          removedAt: new Date(),
        },
      ],
      audienceType: 'APPROVED',
    });

    expect(result.valid).toBe(false);
    expect(result.references).toEqual([]);
    expect(Object.keys(result.errors)).toEqual([
      'references.0',
      'references.1',
      'references.2',
    ]);
  });
});
