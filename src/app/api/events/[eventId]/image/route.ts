import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireEventSettingsManager } from '@/lib/eventManagementApi';
import { ImageUploadError } from '@/lib/imageUploads';
import { claimUploadedImage } from '@/lib/s3-images';

const ALLOWED_EVENT_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

export async function POST(
  request: Request,
  props: { params: Promise<{ eventId: string }> }
) {
  const params = await props.params;
  try {
    const access = await requireEventSettingsManager(params.eventId);
    if (access.response) return access.response;

    const event = await prisma.event.findUnique({
      where: { id: params.eventId },
      select: { id: true, title: true, imageId: true },
    });
    if (!event) return new NextResponse('Not Found', { status: 404 });

    const body = await request.json().catch(() => null);
    if (typeof body?.uploadToken !== 'string' || !body.uploadToken) {
      return NextResponse.json(
        { message: 'An event image is required.' },
        { status: 400 }
      );
    }
    const prompt =
      typeof body.prompt === 'string' && body.prompt.trim()
        ? body.prompt.trim().slice(0, 10_000)
        : null;

    const upload = await claimUploadedImage(body.uploadToken, 'events');
    if (!ALLOWED_EVENT_IMAGE_TYPES.has(upload.mimeType)) {
      return NextResponse.json(
        { message: 'Event images must be JPEG, PNG, WebP, or GIF files.' },
        { status: 400 }
      );
    }
    const image = await prisma.image.create({
      data: {
        key: upload.key,
        bucket: upload.bucket,
        url: upload.url,
        filename: upload.filename,
        mimeType: upload.mimeType,
        size: upload.size,
        alt: `${event.title} event`,
        prompt,
      },
    });
    const updatedEvent = await prisma.event.update({
      where: { id: event.id },
      data: { image: { connect: { id: image.id } } },
      select: { image: { select: { id: true, url: true, alt: true } } },
    });

    if (event.imageId) {
      await prisma.image
        .delete({ where: { id: event.imageId } })
        .catch(error => {
          console.error('[EVENT_IMAGE_CLEANUP]', error);
        });
    }

    return NextResponse.json(updatedEvent.image);
  } catch (error) {
    if (error instanceof ImageUploadError) {
      return NextResponse.json(
        { message: error.message },
        { status: error.status }
      );
    }
    console.error('[EVENT_IMAGE_POST]', error);
    return NextResponse.json(
      { message: 'Unable to upload event image.' },
      { status: 500 }
    );
  }
}
