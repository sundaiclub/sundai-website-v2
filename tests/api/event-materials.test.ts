import { NextRequest } from 'next/server';
import {
  createJsonRequest,
  createRouteContext,
  mockAuthenticatedClerk,
  mockSignedOutClerk,
  resetClerkMocks,
} from '../utils/api-auth';

jest.mock('@clerk/nextjs/server', () =>
  require('../utils/api-auth').mockClerkServerModule()
);

jest.mock('../../src/lib/gcp-storage', () => ({
  __esModule: true,
  createPrivateMaterialUploadIntent: jest.fn(),
  inspectPrivateObject: jest.fn(),
  deletePrivateObject: jest.fn(),
  createSignedMaterialDownloadUrl: jest.fn(),
}));

jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    hacker: { findUnique: jest.fn() },
    event: { findUnique: jest.fn() },
    eventStaff: { findFirst: jest.fn() },
    chapterMembership: { findFirst: jest.fn() },
    eventRegistration: { findFirst: jest.fn() },
    eventMaterial: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    eventMaterialAudit: { create: jest.fn() },
    $transaction: jest.fn(),
  },
}));

const prisma = require('../../src/lib/prisma').default;
const storage = require('../../src/lib/gcp-storage');
const eventId = 'event-ai-build-night';
const materialId = 'material-sponsor-brief';
const objectKey = 'event-materials/private-object';
const uploadToken = Buffer.from(
  JSON.stringify({
    bucket: 'private-event-materials',
    objectKey,
    filename: 'sponsor-brief.pdf',
    mimeType: 'application/pdf',
    size: 481230,
  })
).toString('base64url');

const fileMaterial = {
  id: materialId,
  eventId,
  kind: 'FILE',
  visibility: 'ORGANIZERS_ONLY',
  title: 'Sponsor brief',
  description: null,
  externalUrl: null,
  objectKey,
  bucket: 'private-event-materials',
  originalFilename: 'sponsor-brief.pdf',
  mimeType: 'application/pdf',
  size: 481230,
  position: 30,
  isAvailable: true,
  availableFrom: null,
  availableUntil: null,
  createdById: 'hacker-mc',
  createdAt: new Date('2026-07-10T12:00:00.000Z'),
  updatedAt: new Date('2026-07-10T12:00:00.000Z'),
};

function loadRoute<T>(path: string): T {
  try {
    return require(path) as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Expected event-material route ${path}: ${message}`);
  }
}

function mockOrganizer() {
  mockAuthenticatedClerk({ userId: 'clerk-mc' });
  prisma.hacker.findUnique.mockResolvedValue({
    id: 'hacker-mc',
    clerkId: 'clerk-mc',
    role: 'HACKER',
  });
  prisma.event.findUnique.mockResolvedValue({
    id: eventId,
    chapterId: 'chapter-boston',
    staff: [{ role: 'MC' }],
  });
  prisma.eventStaff.findFirst.mockResolvedValue({
    id: 'staff-mc',
    eventId,
    hackerId: 'hacker-mc',
    role: 'MC',
  });
}

describe('/api/events/[eventId]/materials', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetClerkMocks();
    storage.createPrivateMaterialUploadIntent.mockResolvedValue({
      bucket: 'private-event-materials',
      objectKey,
      uploadUrl: 'https://storage.example.test/signed-upload',
      expiresAt: '2026-07-10T12:15:00.000Z',
    });
    storage.inspectPrivateObject.mockResolvedValue({
      bucket: 'private-event-materials',
      objectKey,
      size: 481230,
      contentType: 'application/pdf',
    });
    storage.deletePrivateObject.mockResolvedValue(undefined);
    storage.createSignedMaterialDownloadUrl.mockResolvedValue({
      url: 'https://storage.example.test/signed-download?signature=short-lived',
      expiresAt: '2026-07-10T12:05:00.000Z',
    });
    prisma.$transaction.mockImplementation(async (operation: any) =>
      typeof operation === 'function' ? operation(prisma) : Promise.all(operation)
    );
  });

  it('creates a private signed upload intent without creating a material row', async () => {
    mockOrganizer();
    const { POST } = loadRoute<{ POST: Function }>(
      '../../src/app/api/events/[eventId]/materials/upload-intents/route'
    );

    const response = await POST(
      createJsonRequest(`/api/events/${eventId}/materials/upload-intents`, {
        method: 'POST',
        body: {
          filename: 'sponsor-brief.pdf',
          mimeType: 'application/pdf',
          size: 481230,
        },
      }),
      createRouteContext({ eventId })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toEqual(
      expect.objectContaining({
        uploadToken: expect.any(String),
        uploadUrl: expect.stringMatching(/^https:/),
      })
    );
    expect(body).not.toHaveProperty('publicUrl');
    expect(prisma.eventMaterial.create).not.toHaveBeenCalled();
  });

  it('creates an HTTPS link with its selected visibility and audit', async () => {
    mockOrganizer();
    prisma.eventMaterial.create.mockResolvedValue({
      ...fileMaterial,
      id: 'material-board',
      kind: 'LINK',
      visibility: 'APPROVED_ATTENDEES',
      title: 'Brainstorming board',
      externalUrl: 'https://example.com/board',
      objectKey: null,
      bucket: null,
      originalFilename: null,
      mimeType: null,
      size: null,
      position: 20,
    });
    const { POST } = loadRoute<{ POST: Function }>(
      '../../src/app/api/events/[eventId]/materials/route'
    );

    const response = await POST(
      createJsonRequest(`/api/events/${eventId}/materials`, {
        method: 'POST',
        body: {
          kind: 'LINK',
          title: 'Brainstorming board',
          externalUrl: 'https://example.com/board',
          visibility: 'APPROVED_ATTENDEES',
          position: 20,
        },
      }),
      createRouteContext({ eventId })
    );

    expect(response.status).toBe(201);
    expect(prisma.eventMaterial.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventId,
          kind: 'LINK',
          visibility: 'APPROVED_ATTENDEES',
          externalUrl: 'https://example.com/board',
        }),
      })
    );
    expect(prisma.eventMaterialAudit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'CREATED' }),
      })
    );
  });

  it('finalizes a verified private file from its opaque upload token', async () => {
    mockOrganizer();
    prisma.eventMaterial.create.mockResolvedValue(fileMaterial);
    const { POST } = loadRoute<{ POST: Function }>(
      '../../src/app/api/events/[eventId]/materials/route'
    );

    const response = await POST(
      createJsonRequest(`/api/events/${eventId}/materials`, {
        method: 'POST',
        body: {
          kind: 'FILE',
          title: 'Sponsor brief',
          uploadToken,
          visibility: 'ORGANIZERS_ONLY',
          position: 30,
        },
      }),
      createRouteContext({ eventId })
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body).toMatchObject({
      kind: 'FILE',
      visibility: 'ORGANIZERS_ONLY',
      originalFilename: 'sponsor-brief.pdf',
    });
    expect(body).not.toHaveProperty('objectKey');
    expect(body).not.toHaveProperty('bucket');
    expect(body).not.toHaveProperty('publicUrl');
  });

  it('updates mutable metadata and writes an audit without replacing file identity', async () => {
    mockOrganizer();
    prisma.eventMaterial.findUnique.mockResolvedValue(fileMaterial);
    prisma.eventMaterial.update.mockResolvedValue({
      ...fileMaterial,
      title: 'Updated sponsor brief',
      visibility: 'APPROVED_ATTENDEES',
      position: 40,
    });
    const { PATCH } = loadRoute<{ PATCH: Function }>(
      '../../src/app/api/events/[eventId]/materials/[materialId]/route'
    );

    const response = await PATCH(
      createJsonRequest(`/api/events/${eventId}/materials/${materialId}`, {
        method: 'PATCH',
        body: {
          title: 'Updated sponsor brief',
          visibility: 'APPROVED_ATTENDEES',
          position: 40,
        },
      }),
      createRouteContext({ eventId, materialId })
    );

    expect(response.status).toBe(200);
    expect(prisma.eventMaterial.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.not.objectContaining({
          kind: expect.anything(),
          objectKey: expect.anything(),
          bucket: expect.anything(),
        }),
      })
    );
    expect(prisma.eventMaterialAudit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'REORDERED' }),
      })
    );
  });

  it('removes the material while preserving a removal audit', async () => {
    mockOrganizer();
    prisma.eventMaterial.findUnique.mockResolvedValue(fileMaterial);
    prisma.eventMaterial.findFirst.mockResolvedValue(fileMaterial);
    prisma.eventMaterial.delete.mockResolvedValue(fileMaterial);
    const { DELETE } = loadRoute<{ DELETE: Function }>(
      '../../src/app/api/events/[eventId]/materials/[materialId]/route'
    );

    const response = await DELETE(
      new NextRequest(
        `http://localhost/api/events/${eventId}/materials/${materialId}`,
        { method: 'DELETE' }
      ),
      createRouteContext({ eventId, materialId })
    );

    expect(response.status).toBe(204);
    expect(prisma.eventMaterialAudit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'REMOVED' }),
      })
    );
    expect(prisma.eventMaterial.delete).toHaveBeenCalled();
  });

  it('rechecks current visibility before redirecting to a short-lived file URL', async () => {
    const { GET } = loadRoute<{ GET: Function }>(
      '../../src/app/api/events/[eventId]/materials/[materialId]/content/route'
    );

    mockSignedOutClerk();
    prisma.eventMaterial.findUnique.mockResolvedValue(fileMaterial);
    const denied = await GET(
      new NextRequest(
        `http://localhost/api/events/${eventId}/materials/${materialId}/content`
      ),
      createRouteContext({ eventId, materialId })
    );
    expect([403, 404]).toContain(denied.status);
    expect(denied.headers.get('location')).toBeNull();

    mockOrganizer();
    const allowed = await GET(
      new NextRequest(
        `http://localhost/api/events/${eventId}/materials/${materialId}/content`
      ),
      createRouteContext({ eventId, materialId })
    );
    expect(allowed.status).toBeGreaterThanOrEqual(300);
    expect(allowed.status).toBeLessThan(400);
    expect(allowed.headers.get('location')).toMatch(/^https:/);
    expect(allowed.headers.get('location')).not.toContain(fileMaterial.objectKey);
  });
});
