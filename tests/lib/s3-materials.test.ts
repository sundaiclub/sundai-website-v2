import { S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { awsCredentialsProvider } from '@vercel/oidc-aws-credentials-provider';
import {
  createPrivateMaterialUploadIntent,
  inspectPrivateObject,
  createSignedMaterialDownloadUrl,
  deletePrivateObject,
} from '@/lib/s3-materials';
const send = jest.fn();
const destroy = jest.fn();
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({ send, destroy })),
  PutObjectCommand: jest
    .fn()
    .mockImplementation(input => ({ input, operation: 'put' })),
  HeadObjectCommand: jest
    .fn()
    .mockImplementation(input => ({ input, operation: 'head' })),
  GetObjectCommand: jest
    .fn()
    .mockImplementation(input => ({ input, operation: 'get' })),
  DeleteObjectCommand: jest
    .fn()
    .mockImplementation(input => ({ input, operation: 'delete' })),
}));
jest.mock('@aws-sdk/s3-request-presigner', () => ({ getSignedUrl: jest.fn() }));
jest.mock('@vercel/oidc-aws-credentials-provider', () => ({
  awsCredentialsProvider: jest.fn().mockReturnValue('oidc'),
}));
const originalEnv = process.env;
beforeEach(() => {
  jest.clearAllMocks();
  process.env = {
    ...originalEnv,
    S3_MATERIALS_BUCKET: 'private-materials',
    S3_MATERIALS_REGION: 'us-east-1',
    S3_IMAGE_BUCKET: 'images',
  };
  delete process.env.VERCEL;
  (getSignedUrl as jest.Mock).mockResolvedValue(
    'https://private-materials.s3.amazonaws.com/signed'
  );
});
afterEach(() => {
  process.env = originalEnv;
});
it('signs a private upload for 15 minutes, including the content type', async () => {
  const intent = await createPrivateMaterialUploadIntent({
    contentType: 'application/pdf',
  });
  expect(intent.bucket).toBe('private-materials');
  expect(intent.objectKey).toMatch(/^event-materials\//);
  expect(getSignedUrl).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({
      input: {
        Bucket: 'private-materials',
        Key: intent.objectKey,
        ContentType: 'application/pdf',
      },
    }),
    { expiresIn: 900, signableHeaders: new Set(['content-type']) }
  );
  expect(S3Client).toHaveBeenCalledWith({
    region: 'us-east-1',
    requestChecksumCalculation: 'WHEN_REQUIRED',
  });
});
it('uses OIDC on Vercel instead of SES credentials', async () => {
  process.env.VERCEL = '1';
  process.env.S3_MATERIALS_ROLE_ARN = 'arn:aws:iam::123:role/materials';
  process.env.AWS_ACCESS_KEY_ID = 'ses';
  await createPrivateMaterialUploadIntent({ contentType: 'application/pdf' });
  expect(awsCredentialsProvider).toHaveBeenCalledWith({
    roleArn: process.env.S3_MATERIALS_ROLE_ARN,
  });
  expect(S3Client).toHaveBeenCalledWith(
    expect.objectContaining({ credentials: 'oidc' })
  );
});
it('requires a separate bucket and rejects stored references to other buckets', async () => {
  await expect(
    inspectPrivateObject({
      bucket: 'images',
      objectKey: 'event-materials/file',
    })
  ).rejects.toThrow('does not match');
  process.env.S3_MATERIALS_BUCKET = 'images';
  await expect(
    createPrivateMaterialUploadIntent({ contentType: 'application/pdf' })
  ).rejects.toThrow('must differ');
  expect(send).not.toHaveBeenCalled();
});
it('checks object size and content type at finalize', async () => {
  send.mockResolvedValue({
    ContentLength: 1024,
    ContentType: 'application/pdf',
  });
  await expect(
    inspectPrivateObject({
      bucket: 'private-materials',
      objectKey: 'event-materials/file',
    })
  ).resolves.toEqual({
    bucket: 'private-materials',
    objectKey: 'event-materials/file',
    size: 1024,
    contentType: 'application/pdf',
  });
  send.mockResolvedValue({ ContentLength: -1 });
  await expect(
    inspectPrivateObject({ objectKey: 'event-materials/file' })
  ).rejects.toThrow('invalid size');
});
it('signs authorized downloads for five minutes and sanitizes the attachment name', async () => {
  await createSignedMaterialDownloadUrl({
    bucket: 'private-materials',
    objectKey: 'event-materials/file',
    filename: 'report"\r\n.pdf',
    contentType: 'application/pdf',
  });
  expect(getSignedUrl).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({
      input: {
        Bucket: 'private-materials',
        Key: 'event-materials/file',
        ResponseContentDisposition: 'attachment; filename="report___.pdf"',
        ResponseContentType: 'application/pdf',
      },
    }),
    { expiresIn: 300 }
  );
});
it('rejects unsafe keys before signing, inspecting or deleting', async () => {
  for (const objectKey of [
    'projects/image',
    'event-materials/../image',
    'event-materials/\\image',
  ]) {
    await expect(deletePrivateObject({ objectKey })).rejects.toThrow(
      'Invalid private material'
    );
  }
  expect(send).not.toHaveBeenCalled();
});
it('deletes only a private material object', async () => {
  send.mockResolvedValue({});
  await deletePrivateObject({
    bucket: 'private-materials',
    objectKey: 'event-materials/file',
  });
  expect(send).toHaveBeenCalledWith({
    input: { Bucket: 'private-materials', Key: 'event-materials/file' },
    operation: 'delete',
  });
  expect(destroy).toHaveBeenCalled();
});
