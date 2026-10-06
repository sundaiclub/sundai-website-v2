import { uploadToS3 } from '@/lib/s3-images';
import { S3Client } from '@aws-sdk/client-s3';
import { awsCredentialsProvider } from '@vercel/oidc-aws-credentials-provider';

const send = jest.fn();
const destroy = jest.fn();
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send, destroy })),
  PutObjectCommand: jest.fn().mockImplementation(input => ({ input })),
}));
jest.mock('@vercel/oidc-aws-credentials-provider', () => ({
  awsCredentialsProvider: jest.fn().mockReturnValue('oidc-provider'),
}));

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
  send.mockResolvedValue({});
});
afterEach(() => {
  process.env = originalEnv;
});

function file() {
  const file = new File(['image'], 'my photo.png', { type: 'image/png' });
  Object.defineProperty(file, 'arrayBuffer', {
    value: async () => Uint8Array.from([105, 109, 97, 103, 101]).buffer,
  });
  return file;
}

it('uses the S3 region and preserves image headers without an ACL', async () => {
  const result = await uploadToS3(file(), 'chapters');
  expect(S3Client).toHaveBeenCalledWith({ region: 'us-east-1' });
  expect(result).toEqual({
    bucket: 'images',
    key: expect.stringMatching(/^chapters\/.*-my_photo.png$/),
    url: expect.stringMatching(/^https:\/\/cdn.example.com\/chapters\//),
  });
  expect(send.mock.calls[0][0].input).toEqual({
    Bucket: 'images',
    Key: result.key,
    Body: expect.any(Buffer),
    ContentLength: 5,
    ContentType: 'image/png',
    CacheControl: 'public, max-age=31536000, immutable',
  });
  expect(destroy).toHaveBeenCalled();
});

it('uses the dedicated OIDC role on Vercel even when SES static credentials exist', async () => {
  process.env.VERCEL = '1';
  process.env.S3_IMAGE_ROLE_ARN = 'arn:aws:iam::123:role/images';
  process.env.AWS_REGION = 'us-east-2';
  process.env.AWS_ACCESS_KEY_ID = 'ses-key';
  await uploadToS3(file());
  expect(awsCredentialsProvider).toHaveBeenCalledWith({
    roleArn: process.env.S3_IMAGE_ROLE_ARN,
  });
  expect(S3Client).toHaveBeenCalledWith({
    region: 'us-east-1',
    credentials: 'oidc-provider',
  });
});

it('fails before uploading when the Vercel role is missing', async () => {
  process.env.VERCEL = '1';
  delete process.env.S3_IMAGE_ROLE_ARN;
  await expect(uploadToS3(file())).rejects.toThrow('Missing S3_IMAGE_ROLE_ARN');
  expect(send).not.toHaveBeenCalled();
});

it('rejects oversized files before contacting S3', async () => {
  const image = file();
  Object.defineProperty(image, 'size', { value: 15 * 1024 * 1024 });
  await expect(uploadToS3(image)).rejects.toThrow('File too large');
  expect(send).not.toHaveBeenCalled();
});
