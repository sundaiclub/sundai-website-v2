import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireChapterManager } from '@/lib/eventManagementApi';
import { resolveChapterId } from '@/lib/chapters';
import { uploadToGCS } from '@/lib/gcp-storage';
import {
  IMAGE_UPLOAD_SIZE_ERROR,
  validateImageUploadSize,
} from '@/lib/imageUploads';

const chapterImageSelect = {
  id: true,
  name: true,
  slug: true,
  city: true,
  region: true,
  country: true,
  timezone: true,
  description: true,
  heroImageId: true,
  heroImage: { select: { id: true, url: true, alt: true, filename: true } },
  status: true,
  accessMode: true,
  mailingListName: true,
  mailingListExternalId: true,
  createdAt: true,
  updatedAt: true,
} as const;

function isUploadFile(value: FormDataEntryValue | null): value is File {
  return (
    value !== null &&
    typeof value === 'object' &&
    'type' in value
  );
}

export async function POST(
  request: Request,
  { params }: { params: { chapterId: string } }
) {
  try {
    const chapterId = await resolveChapterId(params.chapterId);
    if (!chapterId) return new NextResponse('Not Found', { status: 404 });

    const { response } = await requireChapterManager(chapterId);
    if (response) return response;

    const formData = await request.formData();
    const file = formData.get('file');

    if (!isUploadFile(file)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Invalid file type' }, { status: 400 });
    }

    if (validateImageUploadSize(file)) {
      return NextResponse.json(
        { error: IMAGE_UPLOAD_SIZE_ERROR },
        { status: 413 }
      );
    }

    const existing = await prisma.chapter.findUnique({
      where: { id: chapterId },
      select: { id: true, name: true, heroImageId: true },
    });
    if (!existing) return new NextResponse('Not Found', { status: 404 });

    const uploadResult = await uploadToGCS(file, 'chapters');
    const image = await prisma.image.create({
      data: {
        key: uploadResult.filename,
        bucket: process.env.GOOGLE_CLOUD_BUCKET!,
        url: uploadResult.url,
        filename: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        alt: `${existing.name} chapter image`,
      },
    });

    const chapter = await prisma.chapter.update({
      where: { id: chapterId },
      data: { heroImage: { connect: { id: image.id } } },
      select: chapterImageSelect,
    });

    if (existing.heroImageId) {
      await prisma.image
        .delete({ where: { id: existing.heroImageId } })
        .catch(error => {
          console.error('[CHAPTER_IMAGE_CLEANUP]', error);
        });
    }

    return NextResponse.json(chapter);
  } catch (error) {
    console.error('[CHAPTER_IMAGE_POST]', error);
    return NextResponse.json(
      { error: 'Failed to upload chapter image' },
      { status: 500 }
    );
  }
}
