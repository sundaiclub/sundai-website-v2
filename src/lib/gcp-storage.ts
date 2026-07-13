import { Storage } from '@google-cloud/storage';
import { v4 as uuidv4 } from 'uuid';

const MATERIAL_OBJECT_PREFIX = 'event-materials/';
const MATERIAL_UPLOAD_TTL_MS = 15 * 60 * 1000;
const MATERIAL_DOWNLOAD_TTL_MS = 5 * 60 * 1000;

type PrivateObjectReference = {
  bucket?: string;
  objectKey: string;
};

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

function getBucket() {
  const encodedCredentials = process.env.GOOGLE_PRIVATE_KEY;
  if (!encodedCredentials) {
    throw new Error('Missing GOOGLE_PRIVATE_KEY');
  }

  const bucketName = process.env.GOOGLE_CLOUD_BUCKET;
  if (!bucketName) {
    throw new Error('Missing GOOGLE_CLOUD_BUCKET');
  }

  let credentials: { client_email?: string; private_key?: string };
  try {
    credentials = JSON.parse(
      Buffer.from(encodedCredentials, 'base64').toString('utf8')
    );
  } catch {
    throw new Error('Invalid GOOGLE_PRIVATE_KEY');
  }

  const storage = new Storage({ credentials });
  const bucket = storage.bucket(bucketName);

  return {
    bucket,
    serviceAccount: credentials.client_email,
  };
}

function getMaterialsBucket(bucketOverride?: string) {
  const encodedCredentials = process.env.GOOGLE_PRIVATE_KEY;
  if (!encodedCredentials) {
    throw new Error('Missing GOOGLE_PRIVATE_KEY');
  }

  const configuredBucket = process.env.GOOGLE_CLOUD_MATERIALS_BUCKET;
  const bucketName = bucketOverride ?? configuredBucket;
  if (!bucketName) {
    throw new Error('Missing GOOGLE_CLOUD_MATERIALS_BUCKET');
  }
  if (
    bucketOverride &&
    configuredBucket &&
    bucketOverride !== configuredBucket
  ) {
    throw new Error('Material bucket does not match configured private bucket');
  }

  let credentials: { client_email?: string; private_key?: string };
  try {
    credentials = JSON.parse(
      Buffer.from(encodedCredentials, 'base64').toString('utf8')
    );
  } catch {
    throw new Error('Invalid GOOGLE_PRIVATE_KEY');
  }

  return new Storage({ credentials }).bucket(bucketName);
}

function assertMaterialObjectKey(objectKey: string) {
  if (
    !objectKey.startsWith(MATERIAL_OBJECT_PREFIX) ||
    objectKey.includes('..') ||
    objectKey.includes('\\')
  ) {
    throw new Error('Invalid private material object key');
  }
}

function safeDownloadName(filename: string) {
  const normalized = filename
    .normalize('NFKC')
    .replace(/[\r\n"\\/]/g, '_')
    .trim();
  return normalized || 'event-material';
}

export async function createPrivateMaterialUploadIntent({
  contentType,
}: {
  contentType: string;
}): Promise<PrivateMaterialUploadIntent> {
  const bucket = getMaterialsBucket();
  const objectKey = `${MATERIAL_OBJECT_PREFIX}${uuidv4()}`;
  const expiresAt = new Date(Date.now() + MATERIAL_UPLOAD_TTL_MS);
  const [uploadUrl] = await bucket.file(objectKey).getSignedUrl({
    version: 'v4',
    action: 'write',
    expires: expiresAt,
    contentType,
  });

  return {
    bucket: bucket.name,
    objectKey,
    uploadUrl,
    expiresAt: expiresAt.toISOString(),
  };
}

export const createPrivateUploadIntent = createPrivateMaterialUploadIntent;

export async function inspectPrivateObject({
  bucket: bucketName,
  objectKey,
}: PrivateObjectReference): Promise<PrivateObjectMetadata> {
  assertMaterialObjectKey(objectKey);
  const bucket = getMaterialsBucket(bucketName);
  const [metadata] = await bucket.file(objectKey).getMetadata();
  const size = Number(metadata.size);
  if (!Number.isSafeInteger(size) || size < 0) {
    throw new Error('Private material object has invalid size metadata');
  }

  return {
    bucket: bucket.name,
    objectKey,
    size,
    contentType: metadata.contentType ?? null,
  };
}

export async function deletePrivateObject({
  bucket: bucketName,
  objectKey,
}: PrivateObjectReference): Promise<void> {
  assertMaterialObjectKey(objectKey);
  const bucket = getMaterialsBucket(bucketName);
  await bucket.file(objectKey).delete({ ignoreNotFound: true });
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
  const bucket = getMaterialsBucket(bucketName);
  const expiresAt = new Date(Date.now() + MATERIAL_DOWNLOAD_TTL_MS);
  const [url] = await bucket.file(objectKey).getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: expiresAt,
    responseDisposition: `attachment; filename="${safeDownloadName(filename)}"`,
    ...(contentType ? { responseType: contentType } : {}),
  });

  return { url, expiresAt: expiresAt.toISOString() };
}

export const createSignedDownloadUrl = createSignedMaterialDownloadUrl;

export async function uploadToGCS(
  file: File,
  folder: string = 'projects'
): Promise<{
  url: string;
  filename: string;
}> {
  let serviceAccount: string | undefined;
  try {
    const { bucket, serviceAccount: email } = getBucket();
    serviceAccount = email;
    const fileBuffer = await file.arrayBuffer();
    const filename = `${folder}/${uuidv4()}-${file.name.replace(
      /[^a-zA-Z0-9.-]/g,
      '_'
    )}`;
    const blob = bucket.file(filename);

    await blob.save(Buffer.from(fileBuffer), {
      metadata: {
        contentType: file.type,
      },
    });

    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filename}`;

    return {
      url: publicUrl,
      filename,
    };
  } catch (error) {
    console.error('Detailed upload error:', {
      error,
      bucket: process.env.GOOGLE_CLOUD_BUCKET,
      serviceAccount,
    });
    throw error;
  }
}
