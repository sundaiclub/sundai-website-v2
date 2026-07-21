type EventMaterialsModule = {
  MAX_EVENT_MATERIAL_SIZE: number;
  validateEventMaterialUpload: (input: {
    filename: string;
    mimeType: string;
    size: number;
  }) => { valid: boolean; error?: string };
  validateEventMaterialLink: (url: string) => {
    valid: boolean;
    error?: string;
  };
  isEventMaterialAvailable: (material: Material, now?: Date) => boolean;
  filterVisibleEventMaterials: (
    materials: Material[],
    viewer: { isOrganizer?: boolean; registrationStatus?: string | null },
    now?: Date
  ) => Material[];
  finalizeEventMaterialUpload: (args: {
    db: any;
    storage: any;
    eventId: string;
    actorId: string;
    input: Record<string, unknown>;
  }) => Promise<Material>;
  createEventMaterialLink: (args: {
    db: any;
    eventId: string;
    actorId: string;
    input: Record<string, unknown>;
  }) => Promise<Material>;
};

type Material = {
  id: string;
  eventId: string;
  kind: 'LINK' | 'FILE';
  visibility: 'PUBLIC' | 'APPROVED_ATTENDEES' | 'ORGANIZERS_ONLY';
  title: string;
  externalUrl: string | null;
  objectKey: string | null;
  bucket: string | null;
  originalFilename: string | null;
  mimeType: string | null;
  size: number | null;
  isAvailable: boolean;
  availableFrom: Date | null;
  availableUntil: Date | null;
};

const loadEventMaterials = (): EventMaterialsModule => {
  try {
    return require('../../src/lib/eventMaterials') as EventMaterialsModule;
  } catch (error) {
    throw new Error(
      `Expected the event-material domain module for T028. ${String(error)}`
    );
  }
};

const material = (overrides: Partial<Material> = {}): Material => ({
  id: 'material-public-link',
  eventId: 'event-ai-build-night',
  kind: 'LINK',
  visibility: 'PUBLIC',
  title: 'Build night guide',
  externalUrl: 'https://example.com/guide',
  objectKey: null,
  bucket: null,
  originalFilename: null,
  mimeType: null,
  size: null,
  isAvailable: true,
  availableFrom: null,
  availableUntil: null,
  ...overrides,
});

describe('event material policy', () => {
  it('accepts the complete passive-file allowlist up to exactly 25 MiB', () => {
    const domain = loadEventMaterials();
    expect(domain.MAX_EVENT_MATERIAL_SIZE).toBe(26_214_400);

    const allowed = [
      ['brief.pdf', 'application/pdf'],
      ['notes.txt', 'text/plain'],
      ['readme.md', 'text/markdown'],
      ['people.csv', 'text/csv'],
      ['logo.png', 'image/png'],
      ['photo.jpg', 'image/jpeg'],
      ['photo.jpeg', 'image/jpeg'],
      ['banner.webp', 'image/webp'],
      ['animation.gif', 'image/gif'],
      [
        'brief.docx',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ],
      [
        'budget.xlsx',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ],
      [
        'slides.pptx',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      ],
    ];

    for (const [filename, mimeType] of allowed) {
      expect(
        domain.validateEventMaterialUpload({
          filename,
          mimeType,
          size: domain.MAX_EVENT_MATERIAL_SIZE,
        })
      ).toEqual(expect.objectContaining({ valid: true }));
    }
  });

  it('rejects empty, oversized, active, archived, executable, and mismatched files', () => {
    const { validateEventMaterialUpload } = loadEventMaterials();
    const rejected = [
      { filename: 'empty.pdf', mimeType: 'application/pdf', size: 0 },
      { filename: 'large.pdf', mimeType: 'application/pdf', size: 26_214_401 },
      { filename: 'image.svg', mimeType: 'image/svg+xml', size: 10 },
      { filename: 'page.html', mimeType: 'text/html', size: 10 },
      { filename: 'script.js', mimeType: 'text/javascript', size: 10 },
      { filename: 'files.zip', mimeType: 'application/zip', size: 10 },
      {
        filename: 'run.exe',
        mimeType: 'application/vnd.microsoft.portable-executable',
        size: 10,
      },
      { filename: 'actually-html.pdf', mimeType: 'text/html', size: 10 },
    ];

    for (const input of rejected) {
      expect(validateEventMaterialUpload(input).valid).toBe(false);
    }
  });

  it('accepts HTTPS links and rejects HTTP, relative, malformed, and non-web URLs', () => {
    const { validateEventMaterialLink } = loadEventMaterials();

    expect(validateEventMaterialLink('https://example.com/board').valid).toBe(
      true
    );
    for (const url of [
      'http://example.com/board',
      '/private/board',
      'javascript:alert(1)',
      'mailto:organizer@example.com',
      'not a URL',
    ]) {
      expect(validateEventMaterialLink(url).valid).toBe(false);
    }
  });
});

describe('event material visibility and availability', () => {
  const now = new Date('2026-07-18T14:00:00.000Z');
  const materials = [
    material(),
    material({
      id: 'material-approved',
      visibility: 'APPROVED_ATTENDEES',
    }),
    material({ id: 'material-organizers', visibility: 'ORGANIZERS_ONLY' }),
  ];

  it('enforces public, approved-attendee, and organizer visibility', () => {
    const { filterVisibleEventMaterials } = loadEventMaterials();

    expect(
      filterVisibleEventMaterials(materials, {}, now).map(row => row.id)
    ).toEqual(['material-public-link']);
    expect(
      filterVisibleEventMaterials(
        materials,
        { registrationStatus: 'APPROVED' },
        now
      ).map(row => row.id)
    ).toEqual(['material-public-link', 'material-approved']);
    expect(
      filterVisibleEventMaterials(materials, { isOrganizer: true }, now).map(
        row => row.id
      )
    ).toEqual([
      'material-public-link',
      'material-approved',
      'material-organizers',
    ]);
  });

  it('excludes disabled, future, expired, and invalid availability windows', () => {
    const { isEventMaterialAvailable } = loadEventMaterials();

    expect(isEventMaterialAvailable(material(), now)).toBe(true);
    expect(
      isEventMaterialAvailable(material({ isAvailable: false }), now)
    ).toBe(false);
    expect(
      isEventMaterialAvailable(
        material({ availableFrom: new Date('2026-07-18T15:00:00.000Z') }),
        now
      )
    ).toBe(false);
    expect(
      isEventMaterialAvailable(
        material({ availableUntil: new Date('2026-07-18T13:59:59.999Z') }),
        now
      )
    ).toBe(false);
    expect(
      isEventMaterialAvailable(
        material({
          availableFrom: new Date('2026-07-18T16:00:00.000Z'),
          availableUntil: new Date('2026-07-18T15:00:00.000Z'),
        }),
        now
      )
    ).toBe(false);
  });
});

describe('event material finalization and auditing', () => {
  const finalizedMaterial = material({
    id: 'material-file',
    kind: 'FILE',
    visibility: 'ORGANIZERS_ONLY',
    externalUrl: null,
    objectKey: 'events/opaque-token',
    bucket: 'private-materials',
    originalFilename: 'brief.pdf',
    mimeType: 'application/pdf',
    size: 481_230,
  });

  const createDb = () => {
    const transaction = {
      eventMaterial: { create: jest.fn().mockResolvedValue(finalizedMaterial) },
      eventMaterialAudit: { create: jest.fn().mockResolvedValue({}) },
    };
    return {
      transaction,
      db: { $transaction: jest.fn((work: any) => work(transaction)) },
    };
  };

  it('verifies private object metadata then creates the material and CREATED audit atomically', async () => {
    const { finalizeEventMaterialUpload } = loadEventMaterials();
    const { db, transaction } = createDb();
    const storage = {
      inspectPrivateObject: jest.fn().mockResolvedValue({
        objectKey: 'events/opaque-token',
        bucket: 'private-materials',
        filename: 'brief.pdf',
        mimeType: 'application/pdf',
        size: 481_230,
      }),
      deletePrivateObject: jest.fn(),
    };

    const result = await finalizeEventMaterialUpload({
      db,
      storage,
      eventId: 'event-ai-build-night',
      actorId: 'hacker-mc',
      input: {
        uploadToken: 'signed-token',
        title: 'Sponsor brief',
        visibility: 'ORGANIZERS_ONLY',
      },
    });

    expect(result).toEqual(finalizedMaterial);
    expect(storage.inspectPrivateObject).toHaveBeenCalledWith('signed-token');
    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(transaction.eventMaterial.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventId: 'event-ai-build-night',
          createdById: 'hacker-mc',
          kind: 'FILE',
          objectKey: 'events/opaque-token',
        }),
      })
    );
    expect(transaction.eventMaterialAudit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventId: 'event-ai-build-night',
          actorId: 'hacker-mc',
          action: 'CREATED',
        }),
      })
    );
  });

  it('deletes invalid finalized objects and creates neither a material nor an audit', async () => {
    const { finalizeEventMaterialUpload } = loadEventMaterials();
    const { db, transaction } = createDb();
    const storage = {
      inspectPrivateObject: jest.fn().mockResolvedValue({
        objectKey: 'events/opaque-token',
        bucket: 'private-materials',
        filename: 'brief.pdf',
        mimeType: 'text/html',
        size: 481_230,
      }),
      deletePrivateObject: jest.fn().mockResolvedValue(undefined),
    };

    await expect(
      finalizeEventMaterialUpload({
        db,
        storage,
        eventId: 'event-ai-build-night',
        actorId: 'hacker-mc',
        input: {
          uploadToken: 'signed-token',
          title: 'Sponsor brief',
          visibility: 'ORGANIZERS_ONLY',
        },
      })
    ).rejects.toThrow();

    expect(storage.deletePrivateObject).toHaveBeenCalledWith({
      bucket: 'private-materials',
      objectKey: 'events/opaque-token',
    });
    expect(transaction.eventMaterial.create).not.toHaveBeenCalled();
    expect(transaction.eventMaterialAudit.create).not.toHaveBeenCalled();
  });

  it('creates link materials and their immutable CREATED audit in one transaction', async () => {
    const { createEventMaterialLink } = loadEventMaterials();
    const { db, transaction } = createDb();

    await createEventMaterialLink({
      db,
      eventId: 'event-ai-build-night',
      actorId: 'hacker-mc',
      input: {
        title: 'Brainstorming board',
        externalUrl: 'https://example.com/board',
        visibility: 'APPROVED_ATTENDEES',
      },
    });

    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(transaction.eventMaterial.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ kind: 'LINK' }),
      })
    );
    expect(transaction.eventMaterialAudit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'CREATED' }),
      })
    );
  });
});
