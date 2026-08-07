import { POST } from '../../src/app/api/events/generate-images/route';

jest.mock('../../src/lib/eventManagementApi', () => ({
  requireChapterManager: jest.fn(),
}));

jest.mock('../../src/lib/aiImageGeneration', () => ({
  generatePixelArtImages: jest.fn(),
}));

const { requireChapterManager } = require('../../src/lib/eventManagementApi');
const { generatePixelArtImages } = require('../../src/lib/aiImageGeneration');

function request(body: unknown) {
  return { json: jest.fn().mockResolvedValue(body) } as any;
}

describe('/api/events/generate-images', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    requireChapterManager.mockResolvedValue({
      hacker: { id: 'organizer-1' },
      response: null,
    });
    generatePixelArtImages.mockResolvedValue([
      { url: 'https://images.example.com/event.webp', prompt: 'Pixel event' },
    ]);
  });

  it('generates event images for a chapter manager', async () => {
    const response = await POST(
      request({
        chapterId: 'chapter-boston',
        title: 'Boston AI Build Night',
        description: 'A public build night for AI projects.',
      })
    );

    expect(response.status).toBe(200);
    expect(requireChapterManager).toHaveBeenCalledWith('chapter-boston');
    expect(generatePixelArtImages).toHaveBeenCalledWith(
      expect.stringContaining('Event: Boston AI Build Night')
    );
    await expect(response.json()).resolves.toEqual({
      images: [
        {
          url: 'https://images.example.com/event.webp',
          prompt: 'Pixel event',
        },
      ],
    });
  });

  it('rejects incomplete event details before generation', async () => {
    const response = await POST(
      request({ chapterId: 'chapter-boston', title: '', description: '' })
    );

    expect(response.status).toBe(400);
    expect(requireChapterManager).not.toHaveBeenCalled();
    expect(generatePixelArtImages).not.toHaveBeenCalled();
  });

  it('returns the chapter access response', async () => {
    requireChapterManager.mockResolvedValue({
      hacker: { id: 'hacker-1' },
      response: new Response('Forbidden', { status: 403 }),
    });

    const response = await POST(
      request({
        chapterId: 'chapter-boston',
        title: 'Boston AI Build Night',
        description: 'A public build night for AI projects.',
      })
    );

    expect(response.status).toBe(403);
    expect(generatePixelArtImages).not.toHaveBeenCalled();
  });
});
