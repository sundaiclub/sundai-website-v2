import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { PrismaClient, Prisma } from '@prisma/client';
import { S3Client, HeadObjectCommand } from '@aws-sdk/client-s3';
import { fromIni } from '@aws-sdk/credential-provider-ini';
import {
  rewriteImageReferences,
  type CopiedImage,
} from '../src/lib/imageMigration.ts';

// This is an operator tool. It never uses the application's SES credentials.
async function main() {
  if (process.argv.includes('--help')) {
    console.log(
      'node --env-file=.data/image-cutover.env scripts/migrate-images-to-s3.ts [--apply] [--manifest PATH] [--report PATH]\nDefault: dry run. Uses AWS_PROFILE (default: default).'
    );
    return;
  }
  const args = process.argv.slice(2);
  const value = (name: string, fallback: string) => {
    const index = args.indexOf(name);
    if (index < 0) return fallback;
    if (!args[index + 1] || args[index + 1].startsWith('--'))
      throw new Error(`Missing ${name} value`);
    return args[index + 1];
  };
  const apply = args.includes('--apply');
  const manifestPath = value(
    '--manifest',
    '.data/image-migration/manifest.json'
  );
  const reportPath = value(
    '--report',
    `.data/image-migration/db-${apply ? 'applied' : 'dry-run'}.json`
  );
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const {
    S3_IMAGE_BUCKET: bucket,
    S3_IMAGE_REGION: region,
    S3_IMAGE_PUBLIC_BASE_URL: baseUrl,
  } = process.env;
  const databaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!databaseUrl || !bucket || !region || !baseUrl)
    throw new Error('Missing database or S3 configuration');
  if (
    manifest.destinationBucket !== bucket ||
    manifest.region !== region ||
    manifest.sourceBucket !== 'club-site-images'
  )
    throw new Error('Manifest does not match the configured migration');
  const origin = new URL(baseUrl);
  if (
    origin.protocol !== 'https:' ||
    origin.search ||
    origin.hash ||
    origin.username ||
    origin.password
  )
    throw new Error('Invalid public image URL');
  const objects = new Map<string, CopiedImage>(
    manifest.objects.map((item: CopiedImage) => [item.key, item])
  );
  const prisma = new PrismaClient({
    datasources: { db: { url: databaseUrl } },
  });
  const s3 = new S3Client({
    region,
    credentials: fromIni({ profile: process.env.AWS_PROFILE || 'default' }),
  });
  const quote = (name: string) => Prisma.raw(`"${name.replaceAll('"', '""')}"`);
  const changes: {
    model: string;
    table: string;
    idColumn: string;
    id: unknown;
    column: string;
    field: string;
    json: boolean;
    before: unknown;
    after: unknown;
    bucketColumn?: string;
    oldBucket?: unknown;
    keyColumn?: string;
    oldKey?: unknown;
    updatedAt?: string;
    statusColumn?: string;
    oldStatus?: unknown;
  }[] = [];
  const referencedKeys = new Set<string>();
  const unresolved: {
    model: string;
    id: unknown;
    field: string;
    urls: string[];
  }[] = [];
  const historical: { model: string; id: unknown; field: string }[] = [];
  try {
    for (const model of Prisma.dmmf.datamodel.models) {
      const id = model.fields.find(field => field.isId);
      if (!id || model.primaryKey) continue;
      const table = model.dbName || model.name;
      const idColumn = id.dbName || id.name;
      const updatedAt = model.fields.find(field => field.isUpdatedAt);
      const status = model.fields.find(field => field.name === 'status');
      for (const field of model.fields.filter(
        field =>
          !field.isId &&
          !field.isList &&
          ['String', 'Json'].includes(field.type)
      )) {
        const column = field.dbName || field.name;
        const extra =
          model.name === 'Image' ? Prisma.sql`, "key", "bucket"` : Prisma.empty;
        const statusColumn = status
          ? Prisma.sql`, ${quote(status.dbName || status.name)} AS "_status"`
          : Prisma.empty;
        const rows = await prisma.$queryRaw<Record<string, unknown>[]>(
          Prisma.sql`SELECT ${quote(idColumn)} AS "_id", ${quote(column)} AS "_value" ${extra} ${statusColumn} FROM ${quote(table)} WHERE ${quote(column)}::text LIKE ${'%storage.googleapis.com/club-site-images/%'}`
        );
        for (const row of rows) {
          // Audit records, revisions, submitted forms and sent mail are immutable evidence.
          if (
            model.name.endsWith('Audit') ||
            model.name.endsWith('Revision') ||
            model.name === 'EmailDeliveryBatch' ||
            field.name === 'templateSnapshotJson' ||
            (['EventCommunication', 'WeeklyEmail'].includes(model.name) &&
              row._status !== 'DRAFT')
          ) {
            historical.push({
              model: model.name,
              id: row._id,
              field: field.name,
            });
            continue;
          }
          const rewritten = rewriteImageReferences(
            row._value,
            manifest.sourceBucket,
            baseUrl,
            objects
          );
          if (rewritten.unresolved.length)
            unresolved.push({
              model: model.name,
              id: row._id,
              field: field.name,
              urls: rewritten.unresolved,
            });
          for (const key of rewritten.keys) referencedKeys.add(key);
          if (JSON.stringify(row._value) === JSON.stringify(rewritten.value))
            continue;
          const isImage = model.name === 'Image' && field.name === 'url';
          if (
            isImage &&
            (rewritten.keys.length !== 1 || rewritten.keys[0] !== row.key)
          )
            throw new Error(`Image ${row._id} key does not match its URL`);
          changes.push({
            model: model.name,
            table,
            idColumn,
            id: row._id,
            column,
            field: field.name,
            json: field.type === 'Json',
            before: row._value,
            after: rewritten.value,
            ...(['EventCommunication', 'WeeklyEmail'].includes(model.name) &&
            status
              ? {
                  statusColumn: status.dbName || status.name,
                  oldStatus: row._status,
                }
              : {}),
            ...(updatedAt
              ? { updatedAt: updatedAt.dbName || updatedAt.name }
              : {}),
            ...(isImage
              ? {
                  bucketColumn: 'bucket',
                  oldBucket: row.bucket,
                  keyColumn: 'key',
                  oldKey: row.key,
                }
              : {}),
          });
        }
      }
    }
    const verificationErrors: string[] = [];
    const queue = Array.from(referencedKeys);
    await Promise.all(
      Array.from({ length: 8 }, async () => {
        while (queue.length) {
          const key = queue.pop()!;
          const expected = objects.get(key)!;
          try {
            const actual = await s3.send(
              new HeadObjectCommand({ Bucket: bucket, Key: key })
            );
            if (
              actual.ContentLength !== expected.size ||
              actual.ETag?.replaceAll('"', '') !==
                Buffer.from(expected.md5, 'base64').toString('hex') ||
              actual.ContentType !== expected.contentType
            )
              verificationErrors.push(
                `${key}: size, checksum or MIME type mismatch`
              );
          } catch {
            verificationErrors.push(`${key}: S3 read failed`);
          }
        }
      })
    );
    const report = {
      mode: apply ? 'apply' : 'dry-run',
      databaseHost: new URL(databaseUrl).hostname,
      sourceBucket: manifest.sourceBucket,
      destinationBucket: bucket,
      publicBaseUrl: baseUrl,
      changes: changes.map(({ model, id, field, bucketColumn }) => ({
        model,
        id,
        field,
        updatesBucket: !!bucketColumn,
      })),
      referencedObjects: referencedKeys.size,
      unresolved,
      verificationErrors,
      retainedHistoricalReferences: historical,
      applied: false,
    };
    await mkdir(dirname(reportPath), { recursive: true });
    await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n', {
      mode: 0o600,
    });
    console.log(
      `${changes.length} field changes; ${referencedKeys.size} verified objects; ${unresolved.length} unresolved references; ${historical.length} retained historical fields. Report: ${reportPath}`
    );
    if (unresolved.length || verificationErrors.length)
      throw new Error(
        'Migration blocked. Resolve the errors in the report and run again.'
      );
    if (!apply) return;
    await prisma.$transaction(
      async tx => {
        for (const change of changes) {
          const before = change.json
            ? Prisma.sql`${JSON.stringify(change.before)}::jsonb`
            : Prisma.sql`${change.before}`;
          const after = change.json
            ? Prisma.sql`${JSON.stringify(change.after)}::jsonb`
            : Prisma.sql`${change.after}`;
          const bucketUpdate = change.bucketColumn
            ? Prisma.sql`, ${quote(change.bucketColumn)} = ${bucket}`
            : Prisma.empty;
          const metadataGuard = change.bucketColumn
            ? Prisma.sql` AND ${quote(change.bucketColumn)} IS NOT DISTINCT FROM ${change.oldBucket} AND ${quote(change.keyColumn!)} IS NOT DISTINCT FROM ${change.oldKey}`
            : Prisma.empty;
          const statusGuard = change.statusColumn
            ? Prisma.sql` AND ${quote(change.statusColumn)}::text = ${change.oldStatus}`
            : Prisma.empty;
          const timestamp = change.updatedAt
            ? Prisma.sql`, ${quote(change.updatedAt)} = CURRENT_TIMESTAMP`
            : Prisma.empty;
          const affected = await tx.$executeRaw(
            Prisma.sql`UPDATE ${quote(change.table)} SET ${quote(change.column)} = ${after} ${bucketUpdate} ${timestamp} WHERE ${quote(change.idColumn)} = ${change.id} AND ${quote(change.column)} IS NOT DISTINCT FROM ${before} ${metadataGuard} ${statusGuard}`
          );
          if (affected !== 1)
            throw new Error(
              `Concurrent change to ${change.model} ${change.id}; transaction rolled back`
            );
        }
      },
      { isolationLevel: 'Serializable', timeout: 120000, maxWait: 10000 }
    );
    report.applied = true;
    await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n', {
      mode: 0o600,
    });
    console.log(
      'Database image cutover complete. Run the dry run again to check for remaining changes.'
    );
  } finally {
    await prisma.$disconnect();
    s3.destroy();
  }
}
main().catch(error => {
  console.error(error instanceof Error ? error.message : 'Migration failed');
  process.exitCode = 1;
});
