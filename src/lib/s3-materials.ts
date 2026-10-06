import { randomUUID } from 'node:crypto';
import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { awsCredentialsProvider } from '@vercel/oidc-aws-credentials-provider';

const MATERIAL_OBJECT_PREFIX = 'event-materials/';
const MATERIAL_UPLOAD_TTL_SECONDS = 15 * 60;
const MATERIAL_DOWNLOAD_TTL_SECONDS = 5 * 60;
type PrivateObjectReference = { bucket?: string; objectKey: string };
export type PrivateMaterialUploadIntent = {
  bucket: string;
  objectKey: string;
  uploadUrl: string;
  expiresAt: string;
};
export type PrivateObjectMetadata = {
  bucket: string;
  objectKey: string;
  size: number;
  contentType: string | null;
};

function storage(bucketOverride?: string) {
  const bucket = process.env.S3_MATERIALS_BUCKET;
  const region = process.env.S3_MATERIALS_REGION;
  if (!bucket || !region)
    throw new Error('Missing S3_MATERIALS_BUCKET or S3_MATERIALS_REGION');
  if (bucket === process.env.S3_IMAGE_BUCKET)
    throw new Error('Private material bucket must differ from image bucket');
  if (bucketOverride && bucketOverride !== bucket)
    throw new Error('Material bucket does not match configured private bucket');
  const roleArn = process.env.S3_MATERIALS_ROLE_ARN;
  const onVercel = process.env.VERCEL === '1';
  if (onVercel && !roleArn) throw new Error('Missing S3_MATERIALS_ROLE_ARN');
  const client = new S3Client({
    region,
    requestChecksumCalculation: 'WHEN_REQUIRED',
    ...(onVercel
      ? { credentials: awsCredentialsProvider({ roleArn: roleArn! }) }
      : {}),
  });
  return { bucket, client };
}
function assertMaterialObjectKey(objectKey: string) {
  if (
    !objectKey.startsWith(MATERIAL_OBJECT_PREFIX) ||
    objectKey.includes('..') ||
    objectKey.includes('\\')
  )
    throw new Error('Invalid private material object key');
}
function safeDownloadName(filename: string) {
  return (
    filename
      .normalize('NFKC')
      .replace(/[\r\n"\\/]/g, '_')
      .trim() || 'event-material'
  );
}
export async function createPrivateMaterialUploadIntent({
  contentType,
}: {
  contentType: string;
}): Promise<PrivateMaterialUploadIntent> {
  const { bucket, client } = storage();
  const objectKey = `${MATERIAL_OBJECT_PREFIX}${randomUUID()}`;
  const expiresAt = new Date(
    Date.now() + MATERIAL_UPLOAD_TTL_SECONDS * 1000
  ).toISOString();
  try {
    const uploadUrl = await getSignedUrl(
      client,
      new PutObjectCommand({
        Bucket: bucket,
        Key: objectKey,
        ContentType: contentType,
      }),
      {
        expiresIn: MATERIAL_UPLOAD_TTL_SECONDS,
        signableHeaders: new Set(['content-type']),
      }
    );
    return { bucket, objectKey, uploadUrl, expiresAt };
  } finally {
    client.destroy();
  }
}
export async function inspectPrivateObject({
  bucket: bucketName,
  objectKey,
}: PrivateObjectReference): Promise<PrivateObjectMetadata> {
  assertMaterialObjectKey(objectKey);
  const { bucket, client } = storage(bucketName);
  try {
    const metadata = await client.send(
      new HeadObjectCommand({ Bucket: bucket, Key: objectKey })
    );
    const size = metadata.ContentLength;
    if (typeof size !== 'number' || !Number.isSafeInteger(size) || size < 0)
      throw new Error('Private material object has invalid size metadata');
    return {
      bucket,
      objectKey,
      size,
      contentType: metadata.ContentType ?? null,
    };
  } finally {
    client.destroy();
  }
}
export async function deletePrivateObject({
  bucket: bucketName,
  objectKey,
}: PrivateObjectReference): Promise<void> {
  assertMaterialObjectKey(objectKey);
  const { bucket, client } = storage(bucketName);
  try {
    await client.send(
      new DeleteObjectCommand({ Bucket: bucket, Key: objectKey })
    );
  } finally {
    client.destroy();
  }
}
export async function createSignedMaterialDownloadUrl({
  bucket: bucketName,
  objectKey,
  filename,
  contentType,
}: PrivateObjectReference & {
  filename: string;
  contentType?: string | null;
}): Promise<{ url: string; expiresAt: string }> {
  assertMaterialObjectKey(objectKey);
  const { bucket, client } = storage(bucketName);
  const expiresAt = new Date(
    Date.now() + MATERIAL_DOWNLOAD_TTL_SECONDS * 1000
  ).toISOString();
  try {
    const url = await getSignedUrl(
      client,
      new GetObjectCommand({
        Bucket: bucket,
        Key: objectKey,
        ResponseContentDisposition: `attachment; filename="${safeDownloadName(filename)}"`,
        ...(contentType ? { ResponseContentType: contentType } : {}),
      }),
      { expiresIn: MATERIAL_DOWNLOAD_TTL_SECONDS }
    );
    return { url, expiresAt };
  } finally {
    client.destroy();
  }
}
