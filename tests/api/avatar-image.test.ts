import { POST } from '../../src/app/api/hackers/[hackerId]/avatar/route';
import prisma from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';
import { uploadToS3 } from '@/lib/s3-images';

jest.mock('@clerk/nextjs/server', () => ({ auth: jest.fn() }));
jest.mock('@/lib/s3-images', () => ({ uploadToS3: jest.fn() }));
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    hacker: { findUnique: jest.fn(), update: jest.fn() },
    image: { create: jest.fn(), delete: jest.fn() },
  },
}));
const request = (file: File) =>
  ({ formData: async () => ({ get: () => file }) }) as unknown as Request;
beforeEach(() => {
  jest.resetAllMocks();
  (auth as jest.Mock).mockReturnValue({ userId: 'clerk-owner' });
  (prisma.hacker.findUnique as jest.Mock).mockResolvedValue({
    id: 'owner',
    name: 'Owner',
    avatarId: null,
  });
});
it('stores the returned S3 key and bucket for the owner avatar', async () => {
  const file = new File(['image'], 'avatar.png', { type: 'image/png' });
  (uploadToS3 as jest.Mock).mockResolvedValue({
    key: 'avatars/new.png',
    bucket: 's3-images',
    url: 'https://images.example.com/avatars/new.png',
  });
  (prisma.image.create as jest.Mock).mockResolvedValue({ id: 'new-image' });
  (prisma.hacker.update as jest.Mock).mockResolvedValue({
    id: 'owner',
    avatarId: 'new-image',
  });
  const response = await POST(request(file), { params: { hackerId: 'owner' } });
  expect(response.status).toBe(200);
  expect(uploadToS3).toHaveBeenCalledWith(file, 'avatars');
  expect(prisma.image.create).toHaveBeenCalledWith({
    data: expect.objectContaining({
      key: 'avatars/new.png',
      bucket: 's3-images',
      url: 'https://images.example.com/avatars/new.png',
    }),
  });
});
it('does not upload an avatar for another user', async () => {
  const response = await POST(
    request(new File(['image'], 'avatar.png', { type: 'image/png' })),
    { params: { hackerId: 'other' } }
  );
  expect(response.status).toBe(401);
  expect(uploadToS3).not.toHaveBeenCalled();
});
it('rejects an oversized avatar before uploading', async () => {
  const file = new File(['image'], 'avatar.png', { type: 'image/png' });
  Object.defineProperty(file, 'size', { value: 15 * 1024 * 1024 + 1 });
  const response = await POST(request(file), { params: { hackerId: 'owner' } });
  expect(response.status).toBe(413);
  expect(uploadToS3).not.toHaveBeenCalled();
});
