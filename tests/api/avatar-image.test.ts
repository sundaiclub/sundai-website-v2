import { POST } from '../../src/app/api/hackers/[hackerId]/avatar/route';
import prisma from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';
import { ImageUploadError } from '@/lib/imageUploads';
import { claimUploadedImage } from '@/lib/s3-images';

jest.mock('@clerk/nextjs/server', () => ({ auth: jest.fn() }));
jest.mock('@/lib/s3-images', () => ({ claimUploadedImage: jest.fn() }));
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    hacker: { findUnique: jest.fn(), update: jest.fn() },
    image: { create: jest.fn(), delete: jest.fn() },
  },
}));
const request = (body: unknown) =>
  ({ json: async () => body }) as unknown as Request;
beforeEach(() => {
  jest.resetAllMocks();
  (auth as jest.Mock).mockReturnValue({ userId: 'clerk-owner' });
  (prisma.hacker.findUnique as jest.Mock).mockResolvedValue({
    id: 'owner',
    name: 'Owner',
    avatarId: null,
  });
});
it('stores the uploaded S3 key and bucket for the owner avatar', async () => {
  (claimUploadedImage as jest.Mock).mockResolvedValue({
    key: 'avatars/new.png',
    bucket: 's3-images',
    url: 'https://images.example.com/avatars/new.png',
    filename: 'avatar.png',
    mimeType: 'image/png',
    size: 12 * 1024 * 1024,
  });
  (prisma.image.create as jest.Mock).mockResolvedValue({ id: 'new-image' });
  (prisma.hacker.update as jest.Mock).mockResolvedValue({
    id: 'owner',
    avatarId: 'new-image',
  });
  const response = await POST(request({ uploadToken: 'upload-token' }), {
    params: { hackerId: 'owner' },
  });
  expect(response.status).toBe(200);
  expect(claimUploadedImage).toHaveBeenCalledWith('upload-token', 'avatars');
  expect(prisma.image.create).toHaveBeenCalledWith({
    data: {
      key: 'avatars/new.png',
      bucket: 's3-images',
      url: 'https://images.example.com/avatars/new.png',
      filename: 'avatar.png',
      mimeType: 'image/png',
      size: 12 * 1024 * 1024,
      alt: 'Owner avatar',
    },
  });
});
it('does not attach an avatar for another user', async () => {
  const response = await POST(request({ uploadToken: 'upload-token' }), {
    params: { hackerId: 'other' },
  });
  expect(response.status).toBe(401);
  expect(claimUploadedImage).not.toHaveBeenCalled();
});
it('reports an upload that cannot be claimed', async () => {
  (claimUploadedImage as jest.Mock).mockRejectedValue(
    new ImageUploadError(
      'The uploaded image could not be found. Please upload it again.',
      400
    )
  );
  const response = await POST(request({ uploadToken: 'stale' }), {
    params: { hackerId: 'owner' },
  });
  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({
    error: 'The uploaded image could not be found. Please upload it again.',
  });
  expect(prisma.image.create).not.toHaveBeenCalled();
});
