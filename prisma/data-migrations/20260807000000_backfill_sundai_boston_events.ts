export {};

const fs = require('node:fs/promises');
const path = require('node:path');
const { Storage } = require('@google-cloud/storage');
const {
  EventApplicationMode,
  EventProjectCardStatus,
  EventStatus,
  EventVisibility,
  PrismaClient,
  Role,
} = require('@prisma/client');

if (process.env.DIRECT_URL) {
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}

type HistoricalEvent = {
  sourceId: string;
  sourceUrl: string;
  title: string;
  description: string | null;
  startDate: string;
  endDate: string | null;
  timezone: string;
  location: string | null;
  locationInfo: unknown;
  visibility: string | null;
  image: {
    url: string;
    name: string | null;
    contentType: string | null;
    size: number | null;
    width: number | null;
    height: number | null;
  };
};

const prisma = new PrismaClient();
const repositoryRoot = path.resolve(__dirname, '../..');
const manifestPath = path.join(
  repositoryRoot,
  'prisma/data/sundai-boston-partiful-events.json'
);
const imageDirectory = path.join(
  repositoryRoot,
  'prisma/data/sundai-boston-event-images'
);
const PUBLIC_LOCATION = 'Boston, MA';
const IMAGE_FOLDER = 'events/historical/partiful';
const extensionToContentType: Record<string, string> = {
  '.gif': 'image/gif',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

function slugify(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'event'
  );
}

function dateInTimezone(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

function offsetAt(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  const representedAsUtc = Date.UTC(
    Number(value.year),
    Number(value.month) - 1,
    Number(value.day),
    Number(value.hour),
    Number(value.minute),
    Number(value.second)
  );
  return representedAsUtc - date.getTime();
}

function startOfLocalDay(localDate: string, timezone: string) {
  const [year, month, day] = localDate.split('-').map(Number);
  const localMidnightAsUtc = Date.UTC(year, month - 1, day);
  let result = new Date(localMidnightAsUtc);
  for (let iteration = 0; iteration < 3; iteration += 1) {
    result = new Date(localMidnightAsUtc - offsetAt(result, timezone));
  }
  return result;
}

function nextLocalDay(localDate: string) {
  const [year, month, day] = localDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1))
    .toISOString()
    .slice(0, 10);
}

function localDayBounds(date: Date, timezone: string) {
  const localDate = dateInTimezone(date, timezone);
  return {
    start: startOfLocalDay(localDate, timezone),
    end: startOfLocalDay(nextLocalDay(localDate), timezone),
    localDate,
  };
}

async function loadBucket() {
  const encodedCredentials = process.env.GOOGLE_PRIVATE_KEY;
  const bucketName = process.env.GOOGLE_CLOUD_BUCKET;
  if (!encodedCredentials) throw new Error('Missing GOOGLE_PRIVATE_KEY');
  if (!bucketName) throw new Error('Missing GOOGLE_CLOUD_BUCKET');

  const credentials = JSON.parse(
    Buffer.from(encodedCredentials, 'base64').toString('utf8')
  );
  return new Storage({ credentials }).bucket(bucketName);
}

async function loadEvents(): Promise<HistoricalEvent[]> {
  const events = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  if (!Array.isArray(events) || events.length === 0) {
    throw new Error('Historical event manifest is empty or invalid');
  }

  const sourceIds = new Set<string>();
  const localDates = new Set<string>();
  for (const event of events) {
    if (
      !event.sourceId ||
      !event.title ||
      !event.startDate ||
      !event.image?.url
    ) {
      throw new Error('Historical event manifest contains an incomplete event');
    }
    if (sourceIds.has(event.sourceId)) {
      throw new Error(`Duplicate Partiful event ${event.sourceId}`);
    }
    sourceIds.add(event.sourceId);

    const startTime = new Date(event.startDate);
    const localDate = dateInTimezone(startTime, event.timezone);
    if (localDates.has(localDate)) {
      throw new Error(`More than one main hack is configured for ${localDate}`);
    }
    localDates.add(localDate);
  }

  return events;
}

async function findCreator(chapterId: string) {
  const membership = await prisma.chapterMembership.findFirst({
    where: { chapterId, role: 'ADMIN', status: 'ACTIVE' },
    orderBy: [{ joinedAt: 'asc' }, { createdAt: 'asc' }],
    select: { hackerId: true },
  });
  if (membership) return membership.hackerId;

  const siteAdmin = await prisma.hacker.findFirst({
    where: { role: Role.SITE_ADMIN },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (siteAdmin) return siteAdmin.id;

  throw new Error(
    'No Boston chapter admin or site admin can own imported events'
  );
}

async function assetFor(sourceId: string, filenames: string[]) {
  const filename = filenames.find(candidate =>
    candidate.startsWith(`${sourceId}.`)
  );
  if (!filename) throw new Error(`Missing local image for ${sourceId}`);

  const extension = path.extname(filename).toLowerCase();
  const contentType = extensionToContentType[extension];
  if (!contentType) throw new Error(`Unsupported local image ${filename}`);

  const localPath = path.join(imageDirectory, filename);
  const stats = await fs.stat(localPath);
  return { contentType, extension, filename, localPath, size: stats.size };
}

async function uploadAsset(bucket: any, sourceId: string, asset: any) {
  const objectKey = `${IMAGE_FOLDER}/${sourceId}${asset.extension}`;
  const object = bucket.file(objectKey);
  const [exists] = await object.exists();
  if (!exists) {
    await bucket.upload(asset.localPath, {
      destination: objectKey,
      resumable: false,
      metadata: {
        contentType: asset.contentType,
        cacheControl: 'public, max-age=31536000, immutable',
      },
    });
  }
  return {
    objectKey,
    url: `https://storage.googleapis.com/${bucket.name}/${objectKey}`,
  };
}

async function importEvent({
  chapterId,
  creatorId,
  event,
  asset,
  uploaded,
}: {
  chapterId: string;
  creatorId: string;
  event: HistoricalEvent;
  asset: any;
  uploaded: { objectKey: string; url: string };
}) {
  const startTime = new Date(event.startDate);
  const endTime = event.endDate ? new Date(event.endDate) : null;
  const { start, end, localDate } = localDayBounds(startTime, event.timezone);
  const eventId = `partiful-event-${event.sourceId}`;
  const imageId = `partiful-event-image-${event.sourceId}`;
  const slug = `${localDate}-${slugify(event.title).slice(0, 75)}-${event.sourceId.toLowerCase()}`;
  const approvedDetailsJson = event.location
    ? { address: event.location, partifulSourceUrl: event.sourceUrl }
    : { partifulSourceUrl: event.sourceUrl };

  await prisma.$transaction(async (tx: any) => {
    await tx.image.upsert({
      where: { id: imageId },
      create: {
        id: imageId,
        key: uploaded.objectKey,
        bucket: process.env.GOOGLE_CLOUD_BUCKET,
        url: uploaded.url,
        filename: event.image.name || asset.filename,
        mimeType: asset.contentType,
        size: asset.size,
        width: event.image.width,
        height: event.image.height,
        alt: `${event.title} event`,
      },
      update: {
        key: uploaded.objectKey,
        bucket: process.env.GOOGLE_CLOUD_BUCKET,
        url: uploaded.url,
        filename: event.image.name || asset.filename,
        mimeType: asset.contentType,
        size: asset.size,
        width: event.image.width,
        height: event.image.height,
        alt: `${event.title} event`,
      },
    });

    await tx.event.upsert({
      where: { id: eventId },
      create: {
        id: eventId,
        title: event.title,
        description: event.description,
        startTime,
        endTime,
        timezone: event.timezone,
        location: PUBLIC_LOCATION,
        publicLocation: PUBLIC_LOCATION,
        address: event.location,
        approvedDetailsJson,
        createdById: creatorId,
        chapterId,
        slug,
        status: EventStatus.PUBLISHED,
        visibility: EventVisibility.PUBLIC,
        programType: 'SUNDAI_HACK',
        applicationMode: EventApplicationMode.REQUIRES_APPROVAL,
        applicationsOpen: false,
        applicationsClosedAt: endTime || startTime,
        applicationsClosedById: creatorId,
        applicationsCloseReason: 'Historical Partiful import',
        imageId,
      },
      update: {
        title: event.title,
        description: event.description,
        startTime,
        endTime,
        timezone: event.timezone,
        location: PUBLIC_LOCATION,
        publicLocation: PUBLIC_LOCATION,
        address: event.location,
        approvedDetailsJson,
        slug,
        status: EventStatus.PUBLISHED,
        visibility: EventVisibility.PUBLIC,
        programType: 'SUNDAI_HACK',
        applicationMode: EventApplicationMode.REQUIRES_APPROVAL,
        applicationsOpen: false,
        applicationsClosedAt: endTime || startTime,
        applicationsClosedById: creatorId,
        applicationsCloseReason: 'Historical Partiful import',
        imageId,
      },
    });

    const pitchSessions = await tx.pitchSession.findMany({
      where: { chapterId, startTime: { gte: start, lt: end } },
      select: {
        id: true,
        eventId: true,
        legacyBackfill: true,
        projects: { select: { projectId: true, addedById: true } },
      },
    });

    for (const session of pitchSessions) {
      if (!session.eventId && session.legacyBackfill) {
        await tx.pitchSession.update({
          where: { id: session.id },
          data: { eventId, legacyBackfill: false },
        });
      }
      for (const project of session.projects) {
        await tx.eventProject.upsert({
          where: {
            eventId_projectId: { eventId, projectId: project.projectId },
          },
          create: {
            eventId,
            projectId: project.projectId,
            addedById: project.addedById,
            cardStatus: EventProjectCardStatus.APPROVED,
          },
          update: { cardStatus: EventProjectCardStatus.APPROVED },
        });
      }
    }
  });

  return localDate;
}

async function main() {
  const events = await loadEvents();
  const chapter = await prisma.chapter.findUnique({
    where: { slug: 'boston' },
    select: { id: true },
  });
  if (!chapter) throw new Error('Boston chapter does not exist');

  const creatorId = await findCreator(chapter.id);
  const bucket = await loadBucket();
  const filenames = await fs.readdir(imageDirectory);
  let imported = 0;

  for (const event of events) {
    const asset = await assetFor(event.sourceId, filenames);
    const uploaded = await uploadAsset(bucket, event.sourceId, asset);
    const localDate = await importEvent({
      chapterId: chapter.id,
      creatorId,
      event,
      asset,
      uploaded,
    });
    imported += 1;
    console.log(`[${imported}/${events.length}] ${localDate} ${event.title}`);
  }

  console.log(`Imported ${imported} Sundai Boston historical events`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
