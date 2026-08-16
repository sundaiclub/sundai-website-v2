import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import { uploadToGCS } from '@/lib/gcp-storage';

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

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Invalid file type' }, { status: 400 });
    }

    const uploadResult = await uploadToGCS(file, 'avatars');

    const newImage = await prisma.image.create({
      data: {
        key: uploadResult.filename,
        bucket: process.env.GOOGLE_CLOUD_BUCKET!,
        url: uploadResult.url,
        filename: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
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
    console.error('Error uploading avatar:', error);
    return NextResponse.json(
      { error: 'Failed to upload avatar' },
      { status: 500 }
    );
  }
}
