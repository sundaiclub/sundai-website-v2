import { randomUUID } from 'node:crypto';
import { HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { awsCredentialsProvider } from '@vercel/oidc-aws-credentials-provider';
import {
  ImageUploadError,
  MAX_IMAGE_UPLOAD_BYTES,
  type ImageUploadFolder,
  type ImageUploadIntent,
  validateImageUploadSize,
} from './imageUploads';

const UPLOAD_TTL_SECONDS = 10 * 60;
const CACHE_CONTROL = 'public, max-age=31536000, immutable';
const MAX_FILENAME_LENGTH = 255;
const UUID_PATTERN =
  '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

export type UploadedImage = {
  bucket: string;
  key: string;
  url: string;
  filename: string;
  mimeType: string;
  size: number;
};

type UploadTokenData = { key: string; filename: string };

function storage() {
  const region = process.env.S3_IMAGE_REGION;
  const bucket = process.env.S3_IMAGE_BUCKET;
  const baseUrl = process.env.S3_IMAGE_PUBLIC_BASE_URL;
  if (!region || !bucket || !baseUrl) {
    throw new Error('Missing S3 image configuration');
  }
  const publicUrl = new URL(baseUrl);
  if (publicUrl.protocol !== 'https:' || publicUrl.search || publicUrl.hash) {
    throw new Error('Invalid S3 image public base URL');
  }

  const onVercel = process.env.VERCEL === '1';
  const roleArn = process.env.S3_IMAGE_ROLE_ARN;
  if (onVercel && !roleArn) throw new Error('Missing S3_IMAGE_ROLE_ARN');
  const client = new S3Client({
    region,
    ...(onVercel
      ? { credentials: awsCredentialsProvider({ roleArn: roleArn! }) }
      : {}),
  });
  return { bucket, baseUrl, client };
}

function publicImageUrl(baseUrl: string, key: string) {
  return `${baseUrl.replace(/\/$/, '')}/${key.split('/').map(encodeURIComponent).join('/')}`;
}

export async function createImageUploadIntent(input: {
  folder: ImageUploadFolder;
  filename: string;
  contentType: string;
  size: number;
}): Promise<ImageUploadIntent> {
  const filename = input.filename.normalize('NFKC').trim().slice(0, MAX_FILENAME_LENGTH);
  if (!input.contentType.startsWith('image/')) {
    throw new ImageUploadError('Invalid file type', 400);
  }
  if (!Number.isSafeInteger(input.size) || input.size < 1) {
    throw new ImageUploadError('The image file is empty.', 400);
  }
  const sizeError = validateImageUploadSize({ size: input.size });
  if (sizeError) throw new ImageUploadError(sizeError, 413);

  const { bucket, client } = storage();
  const key = `${input.folder}/${randomUUID()}-${filename.replace(/[^a-zA-Z0-9.-]/g, '_') || 'image'}`;
  try {
    // The signed policy is what enforces the size limit: S3 rejects any
    // upload larger than MAX_IMAGE_UPLOAD_BYTES or with a different type.
    const { url, fields } = await createPresignedPost(client, {
      Bucket: bucket,
      Key: key,
      Conditions: [['content-length-range', 1, MAX_IMAGE_UPLOAD_BYTES]],
      Fields: {
        'Content-Type': input.contentType,
        'Cache-Control': CACHE_CONTROL,
      },
      Expires: UPLOAD_TTL_SECONDS,
    });
    const token: UploadTokenData = { key, filename: filename || 'image' };
    return {
      url,
      fields,
      uploadToken: Buffer.from(JSON.stringify(token)).toString('base64url'),
    };
  } finally {
    client.destroy();
  }
}

function parseUploadToken(
  uploadToken: unknown,
  folder: ImageUploadFolder
): UploadTokenData {
  const invalid = new ImageUploadError(
    'The uploaded image could not be found. Please upload it again.',
    400
  );
  if (typeof uploadToken !== 'string' || !uploadToken) throw invalid;
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(uploadToken, 'base64url').toString('utf8'));
  } catch {
    throw invalid;
  }
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    !('key' in parsed) ||
    typeof parsed.key !== 'string' ||
    !('filename' in parsed) ||
    typeof parsed.filename !== 'string' ||
    parsed.filename.length > MAX_FILENAME_LENGTH ||
    !new RegExp(`^${folder}/${UUID_PATTERN}-[a-zA-Z0-9._-]+$`).test(parsed.key)
  ) {
    throw invalid;
  }
  return { key: parsed.key, filename: parsed.filename };
}

// Confirms that the browser finished uploading the object named by an upload
// token and returns the stored object's real size and type.
export async function claimUploadedImage(
  uploadToken: unknown,
  folder: ImageUploadFolder
): Promise<UploadedImage> {
  const { key, filename } = parseUploadToken(uploadToken, folder);
  const { bucket, baseUrl, client } = storage();
  try {
    const metadata = await client
      .send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
      .catch(error => {
        if (error?.name === 'NotFound' || error?.$metadata?.httpStatusCode === 404) {
          return null;
        }
        throw error;
      });
    if (!metadata) {
      throw new ImageUploadError(
        'The uploaded image could not be found. Please upload it again.',
        400
      );
    }
    const size = metadata.ContentLength;
    const mimeType = metadata.ContentType;
    if (typeof size !== 'number' || !mimeType?.startsWith('image/')) {
      throw new ImageUploadError('Invalid file type', 400);
    }
    const sizeError = validateImageUploadSize({ size });
    if (sizeError) throw new ImageUploadError(sizeError, 413);

    return { bucket, key, url: publicImageUrl(baseUrl, key), filename, mimeType, size };
  } finally {
    client.destroy();
  }
}
