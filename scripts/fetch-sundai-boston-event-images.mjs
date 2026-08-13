import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const repositoryRoot = path.resolve(import.meta.dirname, '..');
const manifestPath = path.join(
  repositoryRoot,
  'prisma/data/sundai-boston-partiful-events.json'
);
const outputDirectory = path.join(
  repositoryRoot,
  'prisma/data/sundai-boston-event-images'
);

const extensionByContentType = new Map([
  ['image/gif', '.gif'],
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
]);

const events = JSON.parse(await readFile(manifestPath, 'utf8'));
await mkdir(outputDirectory, { recursive: true });

async function downloadImage(event) {
  if (!event.image?.url) {
    throw new Error(`${event.sourceId} is missing an image URL`);
  }

  const imageUrls = [event.image.url];
  let response;
  for (const imageUrl of imageUrls) {
    response = await fetch(imageUrl, {
      headers: { 'user-agent': 'sundai-boston-historical-event-import/1.0' },
    });
    if (response.ok) break;
  }
  if (!response?.ok) {
    throw new Error(`${event.sourceId} image download failed from all sources`);
  }

  const contentType = response.headers.get('content-type')?.split(';')[0];
  const extension = extensionByContentType.get(contentType);
  if (!extension) {
    throw new Error(
      `${event.sourceId} returned unsupported content type ${contentType}`
    );
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length === 0) {
    throw new Error(`${event.sourceId} returned an empty image`);
  }

  const filename = `${event.sourceId}${extension}`;
  await writeFile(path.join(outputDirectory, filename), bytes);
  return { filename, bytes: bytes.length, contentType };
}

const concurrency = 6;
const results = [];
for (let offset = 0; offset < events.length; offset += concurrency) {
  const batch = events.slice(offset, offset + concurrency);
  results.push(...(await Promise.all(batch.map(downloadImage))));
  console.log(`Downloaded ${results.length}/${events.length} images`);
}

console.log(
  `Saved ${results.length} historical event images to ${outputDirectory}`
);
