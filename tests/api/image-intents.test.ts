import { POST } from '../../src/app/api/uploads/image-intents/route';
import { auth } from '@clerk/nextjs/server';
import { ImageUploadError } from '@/lib/imageUploads';
import { createImageUploadIntent } from '@/lib/s3-images';

jest.mock('@clerk/nextjs/server', () => ({ auth: jest.fn() }));
jest.mock('@/lib/s3-images', () => ({ createImageUploadIntent: jest.fn() }));

const request = (body: unknown) =>
  ({ json: jest.fn().mockResolvedValue(body) }) as any;
const details = {
  folder: 'avatars',
  filename: 'me.png',
  contentType: 'image/png',
  size: 12 * 1024 * 1024,
};

describe('/api/uploads/image-intents', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (auth as jest.Mock).mockReturnValue({ userId: 'clerk-user' });
  });

  it('returns a signed upload for a signed-in user', async () => {
    const intent = {
      url: 'https://bucket.s3.amazonaws.com/',
      fields: { key: 'avatars/key-me.png', Policy: 'policy' },
      uploadToken: 'upload-token',
    };
    (createImageUploadIntent as jest.Mock).mockResolvedValue(intent);

    const response = await POST(request(details));

    expect(response.status).toBe(201);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await response.json()).toEqual(intent);
    expect(createImageUploadIntent).toHaveBeenCalledWith(details);
  });

  it('requires sign-in', async () => {
    (auth as jest.Mock).mockReturnValue({ userId: null });

    const response = await POST(request(details));

    expect(response.status).toBe(401);
    expect(createImageUploadIntent).not.toHaveBeenCalled();
  });

  it.each([
    ['an unknown folder', { ...details, folder: 'event-materials' }],
    ['a missing size', { ...details, size: undefined }],
    ['no body', null],
  ])('rejects %s', async (_label, body) => {
    const response = await POST(request(body));

    expect(response.status).toBe(400);
    expect(createImageUploadIntent).not.toHaveBeenCalled();
  });

  it('returns the size message for a file over the limit', async () => {
    const message =
      'This image is 16.0 MB. Images must be 15 MB or smaller. Try compressing it or saving it as a JPEG or WebP.';
    (createImageUploadIntent as jest.Mock).mockRejectedValue(
      new ImageUploadError(message, 413)
    );

    const response = await POST(request({ ...details, size: 16 * 1024 * 1024 }));

    expect(response.status).toBe(413);
    expect(await response.json()).toEqual({ error: message });
  });
});
