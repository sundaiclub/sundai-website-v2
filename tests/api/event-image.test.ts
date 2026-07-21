import { POST } from '../../src/app/api/events/[eventId]/image/route';

jest.mock('../../src/lib/eventManagementApi', () => ({
  requireEventSettingsManager: jest.fn(),
}));

jest.mock('../../src/lib/gcp-storage', () => ({
  uploadToGCS: jest.fn(),
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
const { requireEventSettingsManager } = require('../../src/lib/eventManagementApi');
const { uploadToGCS } = require('../../src/lib/gcp-storage');

function imageRequest(file: File, prompt?: string) {
  const formData = new FormData();
  formData.append('image', file);
  if (prompt) formData.append('prompt', prompt);
  return { formData: jest.fn().mockResolvedValue(formData) } as any;
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

  it('uploads and connects an event image', async () => {
    uploadToGCS.mockResolvedValue({
      filename: 'events/generated-demo.webp',
      url: 'https://cdn.example.com/generated-demo.webp',
    });
    prisma.image.create.mockResolvedValue({ id: 'image-1' });
    prisma.event.update.mockResolvedValue({
      image: {
        id: 'image-1',
        url: 'https://cdn.example.com/generated-demo.webp',
        alt: 'Demo Night event',
      },
    });

    const response = await POST(
      imageRequest(
        new File(['image-bytes'], 'demo.webp', { type: 'image/webp' }),
        'A pixel-art crowd building AI projects'
      ),
      { params: { eventId: 'event-1' } }
    );

    expect(response.status).toBe(200);
    expect(uploadToGCS).toHaveBeenCalledWith(expect.any(File), 'events');
    expect(prisma.image.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        key: 'events/generated-demo.webp',
        filename: 'demo.webp',
        mimeType: 'image/webp',
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

  it('rejects unsupported files before uploading', async () => {
    const response = await POST(
      imageRequest(new File(['text'], 'notes.txt', { type: 'text/plain' })),
      { params: { eventId: 'event-1' } }
    );

    expect(response.status).toBe(400);
    expect(uploadToGCS).not.toHaveBeenCalled();
    expect(prisma.image.create).not.toHaveBeenCalled();
  });
});
