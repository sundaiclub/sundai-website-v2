import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getCurrentHacker } from '@/lib/eventManagementApi';
import {
  canManageEventMaterialsWithContext,
  getChapterMembershipForPermissions,
  getEventStaffForPermissions,
} from '@/lib/eventManagementAuth';
import { isEventMaterialAvailable } from '@/lib/eventMaterials';
import { createSignedMaterialDownloadUrl } from '@/lib/gcp-storage';

function notFound() {
  return NextResponse.json({ error: 'Material not found' }, { status: 404 });
}

export async function GET(
  _request: Request,
  props: {
    params: Promise<{ eventId: string; materialId: string }>;
  }
) {
  const params = await props.params;
  try {
    const material = await prisma.eventMaterial.findUnique({
      where: { id: params.materialId, eventId: params.eventId },
    });
    if (!material || material.kind !== 'FILE') return notFound();
    if (!isEventMaterialAvailable(material)) return notFound();
    if (!material.objectKey || !material.bucket || !material.originalFilename) {
      return notFound();
    }

    const hacker = await getCurrentHacker();
    let isOrganizer = false;
    let registrationStatus: string | null = null;

    if (hacker) {
      const event = await prisma.event.findUnique({
        where: { id: params.eventId },
        select: { chapterId: true },
      });
      if (!event) return notFound();

      const [chapterMembership, staff, registration] = await Promise.all([
        getChapterMembershipForPermissions(prisma, hacker.id, event.chapterId),
        getEventStaffForPermissions(prisma, hacker.id, params.eventId),
        prisma.eventRegistration.findFirst({
          where: { eventId: params.eventId, hackerId: hacker.id },
          select: { status: true },
        }),
      ]);

      isOrganizer = canManageEventMaterialsWithContext({
        actor: hacker,
        chapterMembership,
        staff,
      });
      registrationStatus = registration?.status ?? null;
    }

    const canDownload =
      isOrganizer ||
      material.visibility === 'PUBLIC' ||
      (material.visibility === 'APPROVED_ATTENDEES' &&
        registrationStatus === 'APPROVED');
    if (!canDownload) return notFound();

    const signed = await createSignedMaterialDownloadUrl({
      bucket: material.bucket,
      objectKey: material.objectKey,
      filename: material.originalFilename,
      contentType: material.mimeType,
    });

    return new NextResponse(null, {
      status: 302,
      headers: { Location: signed.url },
    });
  } catch (error) {
    console.error('[EVENT_MATERIAL_CONTENT_GET]', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
