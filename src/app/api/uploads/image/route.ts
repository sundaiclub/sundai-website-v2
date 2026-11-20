import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { ImageUploadError } from '@/lib/imageUploads';
import { claimUploadedImage } from '@/lib/s3-images';
import prisma from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const upload = await claimUploadedImage(body?.uploadToken, 'projects');
    await prisma.image.create({
      data: {
        key: upload.key,
        bucket: upload.bucket,
        url: upload.url,
        filename: upload.filename,
        mimeType: upload.mimeType,
        size: upload.size,
        alt: upload.filename,
      },
    });

    return NextResponse.json({ url: upload.url });
  } catch (error) {
    if (error instanceof ImageUploadError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    console.error('Error uploading image:', error);
    return NextResponse.json(
      { error: 'Failed to upload image' },
      { status: 500 }
    );
  }
}
