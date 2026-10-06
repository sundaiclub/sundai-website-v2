import { randomUUID } from 'node:crypto';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { awsCredentialsProvider } from '@vercel/oidc-aws-credentials-provider';
import { validateImageUploadSize } from './imageUploads';

type ImageFolder = 'projects' | 'chapters' | 'events' | 'avatars';

export async function uploadToS3(file: File, folder: ImageFolder = 'projects') {
  const sizeError = validateImageUploadSize(file);
  if (sizeError) throw new Error(sizeError);
  if (!file.type.startsWith('image/')) throw new Error('Invalid image type');

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
  const key = `${folder}/${randomUUID()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_') || 'image'}`;
  try {
    const body = Buffer.from(await file.arrayBuffer());
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentLength: body.length,
        ContentType: file.type,
        CacheControl: 'public, max-age=31536000, immutable',
      })
    );
  } finally {
    client.destroy();
  }
  return {
    bucket,
    key,
    url: `${baseUrl.replace(/\/$/, '')}/${key.split('/').map(encodeURIComponent).join('/')}`,
  };
}
