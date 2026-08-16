import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireEventMaterialsManager } from '@/lib/eventManagementApi';
import { deleteEventMaterial, updateEventMaterial } from '@/lib/eventMaterials';

const MUTABLE_FIELDS = [
  'title',
  'description',
  'visibility',
  'position',
  'isAvailable',
  'availableFrom',
  'availableUntil',
] as const;

function jsonError(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

function publicMaterial<T extends Record<string, unknown>>(material: T) {
  const { objectKey: _objectKey, bucket: _bucket, ...safe } = material;
  return safe;
}

async function readUpdate(request: Request) {
  let value: unknown;
  try {
    value = await request.json();
  } catch {
    return { response: jsonError('Request body must be valid JSON', 400) };
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { response: jsonError('Request body must be a JSON object', 400) };
  }

  const body = value as Record<string, unknown>;
  const unsupported = Object.keys(body).filter(
    key => !MUTABLE_FIELDS.includes(key as (typeof MUTABLE_FIELDS)[number])
  );
  if (unsupported.length > 0) {
    return { response: jsonError('Material identity cannot be changed', 400) };
  }

  const input = Object.fromEntries(
    MUTABLE_FIELDS.filter(field => body[field] !== undefined).map(field => [
      field,
      body[field],
    ])
  );
  if (Object.keys(input).length === 0) {
    return { response: jsonError('At least one update is required', 400) };
  }

  return { input };
}

function isNotFound(error: unknown) {
  return (
    (typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2025') ||
    (error instanceof Error && error.message === 'Material not found.')
  );
}

function isValidationError(error: unknown) {
  return (
    error instanceof Error &&
    (error.message.startsWith('Material ') ||
      error.message.includes('availability window'))
  );
}

export async function PATCH(
  request: Request,
  props: {
    params: Promise<{ eventId: string; materialId: string }>;
  }
) {
  const params = await props.params;
  try {
    const access = await requireEventMaterialsManager(params.eventId);
    if (access.response) return access.response;

    const current = await prisma.eventMaterial.findUnique({
      where: { id: params.materialId, eventId: params.eventId },
      select: { id: true },
    });
    if (!current) return jsonError('Material not found', 404);

    const parsed = await readUpdate(request);
    if (parsed.response) return parsed.response;

    const material = await updateEventMaterial({
      eventId: params.eventId,
      materialId: params.materialId,
      actorId: access.hacker!.id,
      input: parsed.input!,
    });

    return NextResponse.json(publicMaterial(material));
  } catch (error) {
    if (isNotFound(error)) return jsonError('Material not found', 404);
    if (isValidationError(error)) {
      return jsonError((error as Error).message, 400);
    }
    console.error('[EVENT_MATERIAL_PATCH]', error);
    return jsonError('Internal Server Error', 500);
  }
}

export async function DELETE(
  _request: Request,
  props: {
    params: Promise<{ eventId: string; materialId: string }>;
  }
) {
  const params = await props.params;
  try {
    const access = await requireEventMaterialsManager(params.eventId);
    if (access.response) return access.response;

    const current = await prisma.eventMaterial.findUnique({
      where: { id: params.materialId, eventId: params.eventId },
      select: { id: true },
    });
    if (!current) return jsonError('Material not found', 404);

    await deleteEventMaterial({
      eventId: params.eventId,
      materialId: params.materialId,
      actorId: access.hacker!.id,
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (isNotFound(error)) return jsonError('Material not found', 404);
    console.error('[EVENT_MATERIAL_DELETE]', error);
    return jsonError('Internal Server Error', 500);
  }
}
