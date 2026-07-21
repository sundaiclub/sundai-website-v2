import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireEventSettingsManager } from '@/lib/eventManagementApi';
import { uploadToGCS } from '@/lib/gcp-storage';

const MAX_EVENT_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_EVENT_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

export async function POST(
  request: Request,
  { params }: { params: { eventId: string } }
) {
  try {
    const access = await requireEventSettingsManager(params.eventId);
    if (access.response) return access.response;

    const event = await prisma.event.findUnique({
      where: { id: params.eventId },
      select: { id: true, title: true, imageId: true },
    });
    if (!event) return new NextResponse('Not Found', { status: 404 });

    const formData = await request.formData();
    const file = formData.get('image');
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json(
        { message: 'An event image is required.' },
        { status: 400 }
      );
    }
    if (!ALLOWED_EVENT_IMAGE_TYPES.has(file.type)) {
      return NextResponse.json(
        { message: 'Event images must be JPEG, PNG, WebP, or GIF files.' },
        { status: 400 }
      );
    }
    if (file.size > MAX_EVENT_IMAGE_BYTES) {
      return NextResponse.json(
        { message: 'Event images must be 10 MB or smaller.' },
        { status: 400 }
      );
    }

    const upload = await uploadToGCS(file, 'events');
    const image = await prisma.image.create({
      data: {
        key: upload.filename,
        bucket: process.env.GOOGLE_CLOUD_BUCKET!,
        url: upload.url,
        filename: file.name,
        mimeType: file.type,
        size: file.size,
        alt: `${event.title} event`,
      },
    });
    const updatedEvent = await prisma.event.update({
      where: { id: event.id },
      data: { image: { connect: { id: image.id } } },
      select: { image: { select: { id: true, url: true, alt: true } } },
    });

    if (event.imageId) {
      await prisma.image.delete({ where: { id: event.imageId } }).catch(error => {
        console.error('[EVENT_IMAGE_CLEANUP]', error);
      });
    }

    return NextResponse.json(updatedEvent.image);
  } catch (error) {
    console.error('[EVENT_IMAGE_POST]', error);
    return NextResponse.json(
      { message: 'Unable to upload event image.' },
      { status: 500 }
    );
  }
}
