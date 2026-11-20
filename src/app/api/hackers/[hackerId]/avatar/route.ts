import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import { ImageUploadError } from '@/lib/imageUploads';
import { claimUploadedImage } from '@/lib/s3-images';

export async function POST(
  request: Request,
  props: { params: Promise<{ hackerId: string }> }
) {
  const params = await props.params;
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const requestingHacker = await prisma.hacker.findUnique({
      where: { clerkId: userId },
    });

    if (!requestingHacker || requestingHacker.id !== params.hackerId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const upload = await claimUploadedImage(body?.uploadToken, 'avatars');

    const newImage = await prisma.image.create({
      data: {
        key: upload.key,
        bucket: upload.bucket,
        url: upload.url,
        filename: upload.filename,
        mimeType: upload.mimeType,
        size: upload.size,
        alt: `${requestingHacker.name} avatar`,
      },
    });

    const existing = await prisma.hacker.findUnique({
      where: { id: params.hackerId },
      select: { avatarId: true },
    });

    const updated = await prisma.hacker.update({
      where: { id: params.hackerId },
      data: {
        avatar: { connect: { id: newImage.id } },
      },
      include: { avatar: true },
    });

    if (existing?.avatarId) {
      await prisma.image
        .delete({ where: { id: existing.avatarId } })
        .catch(error => {
          console.error(
            'Failed to clean up the previous avatar record:',
            error
          );
        });
    }

    return NextResponse.json(updated);
  } catch (error) {
    if (error instanceof ImageUploadError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    console.error('Error uploading avatar:', error);
    return NextResponse.json(
      { error: 'Failed to upload avatar' },
      { status: 500 }
    );
  }
}
