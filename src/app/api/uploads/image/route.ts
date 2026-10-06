import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { uploadToS3 } from '@/lib/s3-images';
import prisma from '@/lib/prisma';
import {
  IMAGE_UPLOAD_SIZE_ERROR,
  validateImageUploadSize,
} from '@/lib/imageUploads';

export async function POST(request: Request) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    if (typeof file === 'string' || !file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Invalid file type' }, { status: 400 });
    }

    if (validateImageUploadSize(file)) {
      return NextResponse.json(
        { error: IMAGE_UPLOAD_SIZE_ERROR },
        { status: 413 }
      );
    }

    // Upload to S3
    const { url, key, bucket } = await uploadToS3(file, 'projects');
    await prisma.image.create({
      data: {
        key,
        bucket,
        url,
        filename: file.name,
        mimeType: file.type,
        size: file.size,
        alt: file.name,
      },
    });

    return NextResponse.json({ url });
  } catch (error) {
    console.error('Error uploading image:', error);
    return NextResponse.json(
      { error: 'Failed to upload image' },
      { status: 500 }
    );
  }
}
