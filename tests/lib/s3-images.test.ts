import { ImageUploadError } from '@/lib/imageUploads';
import { claimUploadedImage, createImageUploadIntent } from '@/lib/s3-images';
import { S3Client } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { awsCredentialsProvider } from '@vercel/oidc-aws-credentials-provider';

const send = jest.fn();
const destroy = jest.fn();
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send, destroy })),
  HeadObjectCommand: jest.fn().mockImplementation(input => ({ input })),
}));
jest.mock('@aws-sdk/s3-presigned-post', () => ({
  createPresignedPost: jest.fn(),
}));
jest.mock('@vercel/oidc-aws-credentials-provider', () => ({
  awsCredentialsProvider: jest.fn().mockReturnValue('oidc-provider'),
}));

const MB = 1024 * 1024;
const KEY = 'chapters/123e4567-e89b-12d3-a456-426614174000-my_photo.png';
const originalEnv = process.env;

beforeEach(() => {
  jest.clearAllMocks();
  process.env = {
    ...originalEnv,
    S3_IMAGE_REGION: 'us-east-1',
    S3_IMAGE_BUCKET: 'images',
    S3_IMAGE_PUBLIC_BASE_URL: 'https://cdn.example.com',
  };
  delete process.env.VERCEL;
  (createPresignedPost as jest.Mock).mockResolvedValue({
    url: 'https://images.s3.amazonaws.com/',
    fields: { key: 'signed-key', Policy: 'policy' },
  });
});
afterEach(() => {
  process.env = originalEnv;
});

function token(data: unknown) {
  return Buffer.from(JSON.stringify(data)).toString('base64url');
}

function intentInput(overrides = {}) {
  return {
    folder: 'chapters' as const,
    filename: 'my photo.png',
    contentType: 'image/png',
    size: 8 * MB,
    ...overrides,
  };
}

describe('createImageUploadIntent', () => {
  it('signs a POST policy that caps the upload at 15 MB', async () => {
    const intent = await createImageUploadIntent(intentInput());

    expect(S3Client).toHaveBeenCalledWith({ region: 'us-east-1' });
    const [, options] = (createPresignedPost as jest.Mock).mock.calls[0];
    expect(options).toEqual({
      Bucket: 'images',
      Key: expect.stringMatching(/^chapters\/[0-9a-f-]{36}-my_photo\.png$/),
      Conditions: [['content-length-range', 1, 15 * MB]],
      Fields: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
      Expires: 600,
    });
    expect(intent.url).toBe('https://images.s3.amazonaws.com/');
    expect(intent.fields).toEqual({ key: 'signed-key', Policy: 'policy' });
    expect(
      JSON.parse(Buffer.from(intent.uploadToken, 'base64url').toString())
    ).toEqual({ key: options.Key, filename: 'my photo.png' });
    expect(destroy).toHaveBeenCalled();
  });

  it('uses the dedicated OIDC role on Vercel', async () => {
    process.env.VERCEL = '1';
    process.env.S3_IMAGE_ROLE_ARN = 'arn:aws:iam::123:role/images';
    await createImageUploadIntent(intentInput());
    expect(awsCredentialsProvider).toHaveBeenCalledWith({
      roleArn: 'arn:aws:iam::123:role/images',
    });
    expect(S3Client).toHaveBeenCalledWith({
      region: 'us-east-1',
      credentials: 'oidc-provider',
    });
  });

  it('fails before signing when the Vercel role is missing', async () => {
    process.env.VERCEL = '1';
    delete process.env.S3_IMAGE_ROLE_ARN;
    await expect(createImageUploadIntent(intentInput())).rejects.toThrow(
      'Missing S3_IMAGE_ROLE_ARN'
    );
    expect(createPresignedPost).not.toHaveBeenCalled();
  });

  it('rejects oversized and non-image files before signing', async () => {
    await expect(
      createImageUploadIntent(intentInput({ size: 16 * MB }))
    ).rejects.toEqual(
      new ImageUploadError(
        'This image is 16.0 MB. Images must be 15 MB or smaller. Try compressing it or saving it as a JPEG or WebP.',
        413
      )
    );
    await expect(
      createImageUploadIntent(intentInput({ contentType: 'text/html' }))
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      createImageUploadIntent(intentInput({ size: 0 }))
    ).rejects.toMatchObject({ status: 400 });
    expect(createPresignedPost).not.toHaveBeenCalled();
  });
});

describe('claimUploadedImage', () => {
  it('returns the stored object size and type', async () => {
    send.mockResolvedValue({ ContentLength: 8 * MB, ContentType: 'image/png' });

    await expect(
      claimUploadedImage(token({ key: KEY, filename: 'my photo.png' }), 'chapters')
    ).resolves.toEqual({
      bucket: 'images',
      key: KEY,
      url: `https://cdn.example.com/${KEY}`,
      filename: 'my photo.png',
      mimeType: 'image/png',
      size: 8 * MB,
    });
    expect(send.mock.calls[0][0].input).toEqual({ Bucket: 'images', Key: KEY });
  });

  it.each([
    ['a missing token', undefined],
    ['a malformed token', 'not-a-token'],
    ['a key from another folder', token({ key: KEY.replace('chapters', 'avatars'), filename: 'x.png' })],
    ['a key outside the upload pattern', token({ key: 'chapters/../secret', filename: 'x.png' })],
  ])('rejects %s without contacting S3', async (_label, uploadToken) => {
    await expect(
      claimUploadedImage(uploadToken, 'chapters')
    ).rejects.toMatchObject({ status: 400 });
    expect(send).not.toHaveBeenCalled();
  });

  it('reports an upload that never reached S3', async () => {
    send.mockRejectedValue(
      Object.assign(new Error('NotFound'), { name: 'NotFound' })
    );
    await expect(
      claimUploadedImage(token({ key: KEY, filename: 'x.png' }), 'chapters')
    ).rejects.toEqual(
      new ImageUploadError(
        'The uploaded image could not be found. Please upload it again.',
        400
      )
    );
  });

  it('rejects a stored object that is not an image', async () => {
    send.mockResolvedValue({ ContentLength: 10, ContentType: 'text/html' });
    await expect(
      claimUploadedImage(token({ key: KEY, filename: 'x.png' }), 'chapters')
    ).rejects.toMatchObject({ status: 400 });
  });
});
