import { POST } from '../../src/app/api/projects/[projectId]/generate-images/route';
import prisma from '../../src/lib/prisma';

jest.mock('@clerk/nextjs/server', () => ({ auth: jest.fn() }));

jest.mock('../../src/lib/prisma', () => ({
  project: { findUnique: jest.fn() },
}));

jest.mock('../../src/lib/aiImageGeneration', () => ({
  generatePixelArtImages: jest.fn(),
}));

const mockAuth = require('@clerk/nextjs/server').auth as jest.Mock;
const { generatePixelArtImages } = require('../../src/lib/aiImageGeneration');
const mockPrisma = prisma as jest.Mocked<typeof prisma>;

function request(body: unknown) {
  return { json: jest.fn().mockResolvedValue(body) } as any;
}

describe('/api/projects/[projectId]/generate-images', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockReturnValue({ userId: 'user-1' });
    mockPrisma.project.findUnique.mockResolvedValue({ id: 'project-1' } as any);
    generatePixelArtImages.mockResolvedValue([
      { url: 'https://images.example.com/project.webp', prompt: 'Pixel art' },
    ]);
  });

  it('generates images from the unsaved project draft', async () => {
    const response = await POST(
      request({
        prompt: 'Show the main product',
        title: 'Unsaved title',
        preview: 'Unsaved short description',
        description: 'Unsaved full description',
        techTags: ['TypeScript', 'React'],
        domainTags: ['AI'],
      }),
      { params: { projectId: 'project-1' } }
    );

    expect(response.status).toBe(200);
    expect(generatePixelArtImages).toHaveBeenCalledWith(
      `Project: Unsaved title
Description: Unsaved short description
Full Description: Unsaved full description
Tech Stack: TypeScript, React
Domain: AI

User Request: Show the main product`
    );
    expect(mockPrisma.project.findUnique).toHaveBeenCalledWith({
      where: { id: 'project-1' },
      select: { id: true },
    });
  });

  it('rejects a request without draft project details', async () => {
    const response = await POST(request({ prompt: 'Show the product' }), {
      params: { projectId: 'project-1' },
    });

    expect(response.status).toBe(400);
    expect(mockPrisma.project.findUnique).not.toHaveBeenCalled();
    expect(generatePixelArtImages).not.toHaveBeenCalled();
  });

  it('requires authentication', async () => {
    mockAuth.mockReturnValue({ userId: null });

    const response = await POST(request({}), {
      params: { projectId: 'project-1' },
    });

    expect(response.status).toBe(401);
    expect(generatePixelArtImages).not.toHaveBeenCalled();
  });
});
