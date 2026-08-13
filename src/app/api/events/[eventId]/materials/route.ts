import { NextResponse } from 'next/server';
import type { EventMaterial } from '@prisma/client';
import prisma from '@/lib/prisma';
import {
  canManageEventMaterialsWithContext,
  getChapterMembershipForPermissions,
} from '@/lib/eventManagementAuth';
import { getCurrentHacker } from '@/lib/eventManagementApi';
import {
  createEventMaterialLink,
  finalizeEventMaterialUpload,
  listVisibleEventMaterials,
} from '@/lib/eventMaterials';

type RouteContext = { params: { eventId: string } };

async function getMaterialViewer(eventId: string) {
  const hacker = await getCurrentHacker();
  if (!hacker) {
    return { hacker: null, isOrganizer: false, registrationStatus: null };
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { id: true, chapterId: true },
  });
  if (!event) return null;

  const [chapterMembership, staff, registration] = await Promise.all([
    getChapterMembershipForPermissions(prisma, hacker.id, event.chapterId),
    prisma.eventStaff.findFirst({
      where: { eventId, hackerId: hacker.id },
      select: { role: true },
    }),
    prisma.eventRegistration.findFirst({
      where: { eventId, hackerId: hacker.id },
      select: { status: true },
    }),
  ]);

  return {
    hacker,
    isOrganizer: canManageEventMaterialsWithContext({
      actor: hacker,
      chapterMembership,
      staff,
    }),
    registrationStatus: registration?.status ?? null,
  };
}

function materialProjection(material: EventMaterial) {
  const { bucket: _bucket, objectKey: _objectKey, ...safe } = material;
  return {
    ...safe,
    ...(material.kind === 'FILE'
      ? {
          contentUrl: `/api/events/${material.eventId}/materials/${material.id}/content`,
        }
      : {}),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const viewer = await getMaterialViewer(params.eventId);
    if (viewer === null) {
      return NextResponse.json({ error: 'Not Found' }, { status: 404 });
    }

    const materials = viewer.isOrganizer
      ? await prisma.eventMaterial.findMany({
          where: { eventId: params.eventId },
          orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
        })
      : await listVisibleEventMaterials({
          eventId: params.eventId,
          viewer: {
            isOrganizer: false,
            registrationStatus: viewer.registrationStatus,
          },
        });

    return NextResponse.json(materials.map(materialProjection));
  } catch (error) {
    console.error('[EVENT_MATERIALS_GET]', error);
    return NextResponse.json(
      { error: 'Unable to load event materials.' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const viewer = await getMaterialViewer(params.eventId);
    if (!viewer?.hacker) {
      return new NextResponse('Unauthorized', { status: 401 });
    }
    if (!viewer.isOrganizer) {
      return new NextResponse('Forbidden', { status: 403 });
    }

    const input: unknown = await request.json();
    if (!isRecord(input)) {
      return NextResponse.json(
        { error: 'Request body must be a JSON object.' },
        { status: 400 }
      );
    }
    let material;
    if (input.kind === 'LINK') {
      material = await createEventMaterialLink({
        eventId: params.eventId,
        actorId: viewer.hacker.id,
        input,
      });
    } else if (input.kind === 'FILE') {
      material = await finalizeEventMaterialUpload({
        eventId: params.eventId,
        actorId: viewer.hacker.id,
        input,
      });
    } else {
      return NextResponse.json(
        { error: 'Material kind must be LINK or FILE.' },
        { status: 400 }
      );
    }

    return NextResponse.json(materialProjection(material), { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to create material.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
