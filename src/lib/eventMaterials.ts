import prisma from '@/lib/prisma';
import type {
  EventMaterialVisibility,
  Prisma,
  PrismaClient,
} from '@prisma/client';
import {
  createPrivateMaterialUploadIntent,
  deletePrivateObject,
  inspectPrivateObject,
} from '@/lib/gcp-storage';
import { normalizeHttpsUrl } from '@/lib/httpsUrls';

export const MAX_EVENT_MATERIAL_SIZE = 25 * 1024 * 1024;
const MAX_EVENT_MATERIAL_PAGE_SIZE = 100;

const MIME_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  txt: 'text/plain',
  md: 'text/markdown',
  csv: 'text/csv',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

const VISIBILITIES: ReadonlySet<string> = new Set([
  'PUBLIC',
  'APPROVED_ATTENDEES',
  'ORGANIZERS_ONLY',
]);

type MaterialLike = {
  visibility: string;
  isAvailable: boolean;
  availableFrom: Date | string | null;
  availableUntil: Date | string | null;
};

type MaterialViewer = {
  isOrganizer?: boolean;
  registrationStatus?: string | null;
};

type MaterialStorage = {
  inspectPrivateObject: (token: string) => Promise<InspectedMaterialObject>;
  deletePrivateObject: (reference: {
    bucket: string;
    objectKey: string;
  }) => Promise<void>;
};

type InspectedMaterialObject = {
  bucket: string;
  objectKey: string;
  size: number;
  filename?: string;
  originalFilename?: string;
  mimeType?: string | null;
  contentType?: string | null;
};

type EventMaterialDb = Pick<
  PrismaClient,
  'eventMaterial' | 'eventMaterialAudit' | '$transaction'
>;

type UploadTokenData = {
  bucket: string;
  objectKey: string;
  filename: string;
  mimeType: string;
  size: number;
};

function isUploadTokenData(value: unknown): value is UploadTokenData {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return (
    'bucket' in value &&
    typeof value.bucket === 'string' &&
    'objectKey' in value &&
    typeof value.objectKey === 'string' &&
    'filename' in value &&
    typeof value.filename === 'string' &&
    'mimeType' in value &&
    typeof value.mimeType === 'string' &&
    'size' in value &&
    typeof value.size === 'number'
  );
}

function result(valid: boolean, error?: string) {
  return error ? { valid, error } : { valid };
}

export function validateEventMaterialUpload(input: {
  filename: string;
  mimeType: string;
  size: number;
}) {
  if (!Number.isSafeInteger(input.size) || input.size < 1) {
    return result(false, 'File must not be empty.');
  }
  if (input.size > MAX_EVENT_MATERIAL_SIZE) {
    return result(false, 'File exceeds the 25 MiB limit.');
  }

  const filename = input.filename.normalize('NFKC').trim();
  const extension = filename.includes('.')
    ? filename.split('.').pop()!.toLowerCase()
    : '';
  if (!extension || MIME_BY_EXTENSION[extension] !== input.mimeType) {
    return result(false, 'File type and extension must match the allowlist.');
  }
  return result(true);
}

export function validateEventMaterialLink(
  url: string
): { valid: true; normalizedUrl: string } | { valid: false; error: string } {
  const result = normalizeHttpsUrl(url);
  if (result.valid) return result;
  return { valid: false, error: `Material link: ${result.error}` };
}

function date(value: Date | string | null) {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function isEventMaterialAvailable(
  material: MaterialLike,
  now = new Date()
) {
  if (!material.isAvailable) return false;
  const from = date(material.availableFrom);
  const until = date(material.availableUntil);
  if (material.availableFrom && !from) return false;
  if (material.availableUntil && !until) return false;
  if (from && until && until <= from) return false;
  if (from && now < from) return false;
  if (until && now >= until) return false;
  return true;
}

export function filterVisibleEventMaterials<T extends MaterialLike>(
  materials: T[],
  viewer: MaterialViewer,
  now = new Date()
) {
  return materials.filter(material => {
    if (!isEventMaterialAvailable(material, now)) return false;
    if (viewer.isOrganizer) return true;
    if (material.visibility === 'PUBLIC') return true;
    return (
      material.visibility === 'APPROVED_ATTENDEES' &&
      viewer.registrationStatus === 'APPROVED'
    );
  });
}

function validateCommonInput(input: Record<string, unknown>) {
  if (typeof input.title !== 'string' || !input.title.trim()) {
    throw new Error('Material title is required.');
  }
  if (!isEventMaterialVisibility(input.visibility)) {
    throw new Error('Material visibility is invalid.');
  }
  const from = materialDate(input.availableFrom);
  const until = materialDate(input.availableUntil);
  if (
    (from && Number.isNaN(from.getTime())) ||
    (until && Number.isNaN(until.getTime())) ||
    (from && until && until <= from)
  ) {
    throw new Error('Material availability window is invalid.');
  }
  return {
    from,
    until,
    title: input.title.trim(),
    visibility: input.visibility,
  };
}

function isEventMaterialVisibility(
  value: unknown
): value is EventMaterialVisibility {
  return typeof value === 'string' && VISIBILITIES.has(value);
}

function materialDate(value: unknown): Date | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' && !(value instanceof Date)) {
    return new Date(Number.NaN);
  }
  return new Date(value);
}

function changeJson(data: Record<string, unknown>) {
  return JSON.parse(JSON.stringify(data));
}

export async function createEventMaterialUploadIntent(input: {
  filename: string;
  mimeType: string;
  size: number;
}) {
  const validation = validateEventMaterialUpload(input);
  if (!validation.valid) throw new Error(validation.error);
  const intent = await createPrivateMaterialUploadIntent({
    contentType: input.mimeType,
  });
  const token: UploadTokenData = {
    bucket: intent.bucket,
    objectKey: intent.objectKey,
    filename: input.filename.normalize('NFKC').trim(),
    mimeType: input.mimeType,
    size: input.size,
  };
  return {
    uploadToken: Buffer.from(JSON.stringify(token)).toString('base64url'),
    uploadUrl: intent.uploadUrl,
    expiresAt: intent.expiresAt,
  };
}

function defaultStorage(): MaterialStorage {
  return {
    async inspectPrivateObject(token: string) {
      let expected: UploadTokenData;
      try {
        const parsed: unknown = JSON.parse(
          Buffer.from(token, 'base64url').toString('utf8')
        );
        if (!isUploadTokenData(parsed)) {
          throw new Error('Upload token has invalid fields.');
        }
        expected = parsed;
      } catch {
        throw new Error('Upload token is invalid.');
      }
      const inspected = await inspectPrivateObject(expected);
      if (
        inspected.size !== expected.size ||
        inspected.contentType !== expected.mimeType
      ) {
        return {
          ...expected,
          size: inspected.size,
          mimeType: inspected.contentType,
        };
      }
      return expected;
    },
    deletePrivateObject,
  };
}

export async function createEventMaterialLink({
  db = prisma,
  eventId,
  actorId,
  input,
}: {
  db?: EventMaterialDb;
  eventId: string;
  actorId: string;
  input: Record<string, unknown>;
}) {
  if (typeof input.externalUrl !== 'string') {
    throw new Error('Material link is required.');
  }
  const link = validateEventMaterialLink(input.externalUrl);
  if (!link.valid) throw new Error(link.error);
  const externalUrl = link.normalizedUrl;
  const { from, until, title, visibility } = validateCommonInput(input);

  return db.$transaction(async tx => {
    const material = await tx.eventMaterial.create({
      data: {
        eventId,
        createdById: actorId,
        kind: 'LINK',
        visibility,
        title,
        description:
          typeof input.description === 'string'
            ? input.description.trim() || null
            : null,
        externalUrl,
        position: typeof input.position === 'number' ? input.position : 0,
        isAvailable:
          typeof input.isAvailable === 'boolean' ? input.isAvailable : true,
        availableFrom: from,
        availableUntil: until,
      },
    });
    await tx.eventMaterialAudit.create({
      data: {
        eventId,
        materialId: material.id,
        actorId,
        action: 'CREATED',
        changeJson: changeJson({ kind: 'LINK', visibility: input.visibility }),
      },
    });
    return material;
  });
}

export async function finalizeEventMaterialUpload({
  db = prisma,
  storage = defaultStorage(),
  eventId,
  actorId,
  input,
}: {
  db?: EventMaterialDb;
  storage?: MaterialStorage;
  eventId: string;
  actorId: string;
  input: Record<string, unknown>;
}) {
  const { from, until, title, visibility } = validateCommonInput(input);
  if (typeof input.uploadToken !== 'string' || !input.uploadToken) {
    throw new Error('Upload token is required.');
  }
  const metadata = await storage.inspectPrivateObject(input.uploadToken);
  const filename = metadata.filename ?? metadata.originalFilename;
  const mimeType = metadata.mimeType ?? metadata.contentType;
  if (!filename || !mimeType) {
    throw new Error('Uploaded file metadata is incomplete.');
  }
  const validation = validateEventMaterialUpload({
    filename,
    mimeType,
    size: metadata.size,
  });
  if (!validation.valid) {
    await storage.deletePrivateObject({
      bucket: metadata.bucket,
      objectKey: metadata.objectKey,
    });
    throw new Error(validation.error);
  }

  try {
    return await db.$transaction(async tx => {
      const material = await tx.eventMaterial.create({
        data: {
          eventId,
          createdById: actorId,
          kind: 'FILE',
          visibility,
          title,
          description:
            typeof input.description === 'string'
              ? input.description.trim() || null
              : null,
          externalUrl: null,
          objectKey: metadata.objectKey,
          bucket: metadata.bucket,
          originalFilename: filename,
          mimeType,
          size: metadata.size,
          position: typeof input.position === 'number' ? input.position : 0,
          isAvailable:
            typeof input.isAvailable === 'boolean' ? input.isAvailable : true,
          availableFrom: from,
          availableUntil: until,
        },
      });
      await tx.eventMaterialAudit.create({
        data: {
          eventId,
          materialId: material.id,
          actorId,
          action: 'CREATED',
          changeJson: changeJson({
            kind: 'FILE',
            visibility: input.visibility,
            originalFilename: filename,
            mimeType,
            size: metadata.size,
          }),
        },
      });
      return material;
    });
  } catch (error) {
    await storage.deletePrivateObject({
      bucket: metadata.bucket,
      objectKey: metadata.objectKey,
    });
    throw error;
  }
}

export async function listVisibleEventMaterials({
  db = prisma,
  eventId,
  viewer,
  now = new Date(),
  take = MAX_EVENT_MATERIAL_PAGE_SIZE,
  skip = 0,
}: {
  db?: EventMaterialDb;
  eventId: string;
  viewer: MaterialViewer;
  now?: Date;
  take?: number;
  skip?: number;
}) {
  const boundedTake = Math.min(Math.max(take, 1), MAX_EVENT_MATERIAL_PAGE_SIZE);
  const rows = await db.eventMaterial.findMany({
    where: { eventId },
    orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    take: boundedTake,
    skip: Math.max(skip, 0),
  });
  return filterVisibleEventMaterials(rows, viewer, now);
}

export async function updateEventMaterial({
  db = prisma,
  eventId,
  materialId,
  actorId,
  input,
}: {
  db?: EventMaterialDb;
  eventId: string;
  materialId: string;
  actorId: string;
  input: Record<string, unknown>;
}) {
  const { from, until, title, visibility } = validateCommonInput({
    title: input.title ?? 'unchanged',
    visibility: input.visibility ?? 'PUBLIC',
    availableFrom: input.availableFrom,
    availableUntil: input.availableUntil,
  });
  const data: Prisma.EventMaterialUpdateInput = {};
  if (input.title !== undefined) data.title = title;
  if (input.visibility !== undefined) data.visibility = visibility;
  if (input.description !== undefined) {
    if (input.description !== null && typeof input.description !== 'string') {
      throw new Error('Material description is invalid.');
    }
    data.description = input.description?.trim() || null;
  }
  if (input.position !== undefined) {
    if (!Number.isSafeInteger(input.position) || Number(input.position) < 0) {
      throw new Error('Material position is invalid.');
    }
    data.position = Number(input.position);
  }
  if (input.isAvailable !== undefined) {
    if (typeof input.isAvailable !== 'boolean') {
      throw new Error('Material availability is invalid.');
    }
    data.isAvailable = input.isAvailable;
  }
  if (input.availableFrom !== undefined) data.availableFrom = from;
  if (input.availableUntil !== undefined) data.availableUntil = until;

  return db.$transaction(async tx => {
    const material = await tx.eventMaterial.update({
      where: { id: materialId, eventId },
      data,
    });
    await tx.eventMaterialAudit.create({
      data: {
        eventId,
        materialId,
        actorId,
        action: input.position === undefined ? 'UPDATED' : 'REORDERED',
        changeJson: changeJson(input),
      },
    });
    return material;
  });
}

export async function reorderEventMaterials({
  db = prisma,
  eventId,
  actorId,
  materialIds,
}: {
  db?: EventMaterialDb;
  eventId: string;
  actorId: string;
  materialIds: string[];
}) {
  if (new Set(materialIds).size !== materialIds.length) {
    throw new Error('Material ordering contains duplicate ids.');
  }
  return db.$transaction(async tx =>
    Promise.all(
      materialIds.map(async (materialId, position) => {
        const row = await tx.eventMaterial.update({
          where: { id: materialId, eventId },
          data: { position },
        });
        await tx.eventMaterialAudit.create({
          data: {
            eventId,
            materialId,
            actorId,
            action: 'REORDERED',
            changeJson: { position },
          },
        });
        return row;
      })
    )
  );
}

export async function deleteEventMaterial({
  db = prisma,
  storage = defaultStorage(),
  eventId,
  materialId,
  actorId,
}: {
  db?: EventMaterialDb;
  storage?: MaterialStorage;
  eventId: string;
  materialId: string;
  actorId: string;
}) {
  const removed = await db.$transaction(async tx => {
    const current = await tx.eventMaterial.findFirst({
      where: { id: materialId, eventId },
    });
    if (!current) throw new Error('Material not found.');
    await tx.eventMaterialAudit.create({
      data: {
        eventId,
        materialId,
        actorId,
        action: 'REMOVED',
        changeJson: changeJson({
          title: current.title,
          kind: current.kind,
          visibility: current.visibility,
          originalFilename: current.originalFilename,
        }),
      },
    });
    await tx.eventMaterial.delete({ where: { id: materialId } });
    return current;
  });
  if (removed.kind === 'FILE' && removed.bucket && removed.objectKey) {
    await storage.deletePrivateObject({
      bucket: removed.bucket,
      objectKey: removed.objectKey,
    });
  }
  return removed;
}
