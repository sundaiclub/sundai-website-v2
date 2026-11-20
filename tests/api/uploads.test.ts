import { POST } from '../../src/app/api/uploads/image/route';
import prisma from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';
import { ImageUploadError } from '@/lib/imageUploads';
import { claimUploadedImage } from '@/lib/s3-images';

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: { image: { create: jest.fn() } },
}));
jest.mock('@clerk/nextjs/server', () => ({ auth: jest.fn() }));
jest.mock('@/lib/s3-images', () => ({ claimUploadedImage: jest.fn() }));

const request = (body: unknown) =>
  ({ json: jest.fn().mockResolvedValue(body) }) as any;

describe('/api/uploads/image', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (auth as jest.Mock).mockReturnValue({ userId: 'test-user-id' });
    (prisma.image.create as jest.Mock).mockResolvedValue({ id: 'image-id' });
  });

  it('records an uploaded image and returns its URL', async () => {
    (claimUploadedImage as jest.Mock).mockResolvedValue({
      url: 'https://images.example.com/image.jpg',
      key: 'projects/image.jpg',
      bucket: 'bucket',
      filename: 'test.jpg',
      mimeType: 'image/jpeg',
      size: 10 * 1024 * 1024,
    });

    const response = await POST(request({ uploadToken: 'upload-token' }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      url: 'https://images.example.com/image.jpg',
    });
    expect(claimUploadedImage).toHaveBeenCalledWith('upload-token', 'projects');
    expect(prisma.image.create).toHaveBeenCalledWith({
      data: {
        key: 'projects/image.jpg',
        bucket: 'bucket',
        url: 'https://images.example.com/image.jpg',
        filename: 'test.jpg',
        mimeType: 'image/jpeg',
        size: 10 * 1024 * 1024,
        alt: 'test.jpg',
      },
    });
  });

  it('returns 401 when the user is not signed in', async () => {
    (auth as jest.Mock).mockReturnValue({ userId: null });

    const response = await POST(request({ uploadToken: 'upload-token' }));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Unauthorized' });
    expect(claimUploadedImage).not.toHaveBeenCalled();
  });

  it('reports an upload that cannot be claimed', async () => {
    (claimUploadedImage as jest.Mock).mockRejectedValue(
      new ImageUploadError(
        'The uploaded image could not be found. Please upload it again.',
        400
      )
    );

    const response = await POST(request({}));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'The uploaded image could not be found. Please upload it again.',
    });
    expect(prisma.image.create).not.toHaveBeenCalled();
  });

  it('hides unexpected storage errors', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    (claimUploadedImage as jest.Mock).mockRejectedValue(new Error('S3 down'));

    const response = await POST(request({ uploadToken: 'upload-token' }));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Failed to upload image' });
    consoleSpy.mockRestore();
  });
});
