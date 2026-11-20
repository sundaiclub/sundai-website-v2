import { POST } from '../../src/app/api/events/[eventId]/image/route';
import { ImageUploadError } from '../../src/lib/imageUploads';

jest.mock('../../src/lib/eventManagementApi', () => ({
  requireEventSettingsManager: jest.fn(),
}));

jest.mock('../../src/lib/s3-images', () => ({
  claimUploadedImage: jest.fn(),
}));

jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    event: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    image: {
      create: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

const prisma = require('../../src/lib/prisma').default;
const {
  requireEventSettingsManager,
} = require('../../src/lib/eventManagementApi');
const { claimUploadedImage } = require('../../src/lib/s3-images');

function imageRequest(body: unknown) {
  return { json: jest.fn().mockResolvedValue(body) } as any;
}

function uploaded(overrides = {}) {
  return {
    key: 'events/generated-demo.webp',
    bucket: 's3-images',
    url: 'https://cdn.example.com/generated-demo.webp',
    filename: 'demo.webp',
    mimeType: 'image/webp',
    size: 9 * 1024 * 1024,
    ...overrides,
  };
}

describe('/api/events/[eventId]/image', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requireEventSettingsManager.mockResolvedValue({
      hacker: { id: 'organizer-1' },
      response: null,
    });
    prisma.event.findUnique.mockResolvedValue({
      id: 'event-1',
      title: 'Demo Night',
      imageId: null,
    });
  });

  it('claims and connects an uploaded event image', async () => {
    claimUploadedImage.mockResolvedValue(uploaded());
    prisma.image.create.mockResolvedValue({ id: 'image-1' });
    prisma.event.update.mockResolvedValue({
      image: {
        id: 'image-1',
        url: 'https://cdn.example.com/generated-demo.webp',
        alt: 'Demo Night event',
      },
    });

    const response = await POST(
      imageRequest({
        uploadToken: 'upload-token',
        prompt: 'A pixel-art crowd building AI projects',
      }),
      { params: { eventId: 'event-1' } }
    );

    expect(response.status).toBe(200);
    expect(claimUploadedImage).toHaveBeenCalledWith('upload-token', 'events');
    expect(prisma.image.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        key: 'events/generated-demo.webp',
        filename: 'demo.webp',
        mimeType: 'image/webp',
        size: 9 * 1024 * 1024,
        alt: 'Demo Night event',
        prompt: 'A pixel-art crowd building AI projects',
      }),
    });
    expect(prisma.event.update).toHaveBeenCalledWith({
      where: { id: 'event-1' },
      data: { image: { connect: { id: 'image-1' } } },
      select: { image: { select: { id: true, url: true, alt: true } } },
    });
  });

  it('requires an upload token', async () => {
    const response = await POST(imageRequest({}), {
      params: { eventId: 'event-1' },
    });

    expect(response.status).toBe(400);
    expect(claimUploadedImage).not.toHaveBeenCalled();
  });

  it('rejects unsupported image types', async () => {
    claimUploadedImage.mockResolvedValue(
      uploaded({ mimeType: 'image/svg+xml' })
    );

    const response = await POST(imageRequest({ uploadToken: 'upload-token' }), {
      params: { eventId: 'event-1' },
    });

    expect(response.status).toBe(400);
    expect(prisma.image.create).not.toHaveBeenCalled();
  });

  it('reports an upload that cannot be claimed', async () => {
    claimUploadedImage.mockRejectedValue(
      new ImageUploadError(
        'The uploaded image could not be found. Please upload it again.',
        400
      )
    );

    const response = await POST(imageRequest({ uploadToken: 'stale' }), {
      params: { eventId: 'event-1' },
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      message: 'The uploaded image could not be found. Please upload it again.',
    });
    expect(prisma.image.create).not.toHaveBeenCalled();
  });
});
