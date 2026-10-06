import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import {
  S3Client,
  HeadObjectCommand,
  PutObjectCommand,
  type HeadObjectCommandOutput,
} from '@aws-sdk/client-s3';
import { fromIni } from '@aws-sdk/credential-provider-ini';
import { imagePublicUrl } from '../src/lib/imageMigration.ts';

const exec = promisify(execFile);
async function main() {
  if (process.argv.includes('--help')) {
    console.log(
      'node --env-file=.data/image-cutover.env scripts/copy-images-to-s3.ts\nCopies missing or changed public GCP images. Checks hashes and metadata. Uses gcloud login and AWS_PROFILE.'
    );
    return;
  }
  const sourceBucket = 'club-site-images';
  const {
    S3_IMAGE_BUCKET: bucket,
    S3_IMAGE_REGION: region,
    S3_IMAGE_PUBLIC_BASE_URL: baseUrl,
  } = process.env;
  if (!bucket || !region || !baseUrl)
    throw new Error('Missing S3 image configuration');
  const list = async () => {
    const result = await exec(
      'gcloud',
      ['storage', 'ls', '--json', `gs://${sourceBucket}/**`],
      { maxBuffer: 64 * 1024 * 1024 }
    );
    return JSON.parse(result.stdout)
      .filter((item: any) => item.type === 'cloud_object')
      .map((item: any) => item.metadata);
  };
  const source = await list();
  const s3 = new S3Client({
    region,
    credentials: fromIni({ profile: process.env.AWS_PROFILE || 'default' }),
  });
  let copied = 0;
  const objects: any[] = [];
  const queue = [...source];
  try {
    await Promise.all(
      Array.from({ length: 4 }, async () => {
        while (queue.length) {
          const item = queue.pop();
          if (
            !item.md5Hash ||
            !item.contentType ||
            !/^(projects|chapters|events|avatars)\//.test(item.name)
          )
            throw new Error(`Unsupported source object: ${item.name}`);
          const expected = Buffer.from(item.md5Hash, 'base64').toString('hex');
          const headers = {
            ContentType: item.contentType,
            CacheControl: item.cacheControl,
            ContentDisposition: item.contentDisposition,
            ContentEncoding: item.contentEncoding,
            Metadata: item.metadata || {},
          };
          let head: HeadObjectCommandOutput | undefined;
          try {
            head = await s3.send(
              new HeadObjectCommand({ Bucket: bucket, Key: item.name })
            );
          } catch (error: any) {
            if (error.$metadata?.httpStatusCode !== 404) throw error;
          }
          const matches = (actual: typeof head) =>
            actual &&
            actual.ContentLength === Number(item.size) &&
            actual.ETag?.replaceAll('"', '') === expected &&
            Object.entries(headers).every(([key, value]) =>
              key === 'Metadata'
                ? JSON.stringify(
                    Object.entries((actual as any)[key] || {}).sort()
                  ) === JSON.stringify(Object.entries(value || {}).sort())
                : ((actual as any)[key] || null) === (value || null)
            );
          if (!matches(head)) {
            const { stdout: body } = await exec(
              'gcloud',
              [
                'storage',
                'cat',
                `gs://${sourceBucket}/${item.name}#${item.generation}`,
              ],
              { encoding: 'buffer', maxBuffer: 512 * 1024 * 1024 }
            );
            if (
              body.length !== Number(item.size) ||
              createHash('md5').update(body).digest('hex') !== expected
            )
              throw new Error(`Source checksum mismatch: ${item.name}`);
            await s3.send(
              new PutObjectCommand({
                Bucket: bucket,
                Key: item.name,
                Body: body,
                ContentLength: body.length,
                ContentMD5: item.md5Hash,
                ...headers,
              })
            );
            head = await s3.send(
              new HeadObjectCommand({ Bucket: bucket, Key: item.name })
            );
            if (!matches(head))
              throw new Error(`Destination verification failed: ${item.name}`);
            copied++;
          }
          objects.push({
            key: item.name,
            size: Number(item.size),
            md5: item.md5Hash,
            contentType: item.contentType,
            cacheControl: item.cacheControl || null,
            contentDisposition: item.contentDisposition || null,
            contentEncoding: item.contentEncoding || null,
            metadata: item.metadata || {},
            generation: item.generation,
            sourceUrl: `https://storage.googleapis.com/${sourceBucket}/${item.name}`,
            destinationUrl: imagePublicUrl(baseUrl, item.name),
          });
        }
      })
    );
    const latest = await list();
    const fingerprint = (items: any[]) =>
      JSON.stringify(
        items
          .map(item => [item.name, item.generation, item.metageneration])
          .sort()
      );
    if (fingerprint(source) !== fingerprint(latest))
      throw new Error(
        'Source changed during copy. Pause uploads and run again. Manifest was not replaced.'
      );
    objects.sort((a, b) => a.key.localeCompare(b.key));
    await mkdir('.data/image-migration', { recursive: true });
    await writeFile(
      '.data/image-migration/manifest.json',
      JSON.stringify(
        {
          sourceBucket,
          destinationBucket: bucket,
          region,
          verifiedAt: new Date().toISOString(),
          objects,
        },
        null,
        2
      ) + '\n',
      { mode: 0o600 }
    );
    console.log(
      `${objects.length} objects verified; ${copied} copied. Manifest: .data/image-migration/manifest.json`
    );
  } finally {
    s3.destroy();
  }
}
main().catch(error => {
  console.error(error instanceof Error ? error.message : 'Image copy failed');
  process.exitCode = 1;
});
