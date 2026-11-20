import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireChapterManager } from '@/lib/eventManagementApi';
import { resolveChapterId } from '@/lib/chapters';
import { ImageUploadError } from '@/lib/imageUploads';
import { claimUploadedImage } from '@/lib/s3-images';

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

export async function POST(
  request: Request,
  props: { params: Promise<{ chapterId: string }> }
) {
  const params = await props.params;
  try {
    const chapterId = await resolveChapterId(params.chapterId);
    if (!chapterId) return new NextResponse('Not Found', { status: 404 });

    const { response } = await requireChapterManager(chapterId);
    if (response) return response;

    const body = await request.json().catch(() => null);

    const existing = await prisma.chapter.findUnique({
      where: { id: chapterId },
      select: { id: true, name: true, heroImageId: true },
    });
    if (!existing) return new NextResponse('Not Found', { status: 404 });

    const upload = await claimUploadedImage(body?.uploadToken, 'chapters');
    const image = await prisma.image.create({
      data: {
        key: upload.key,
        bucket: upload.bucket,
        url: upload.url,
        filename: upload.filename,
        mimeType: upload.mimeType,
        size: upload.size,
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
    if (error instanceof ImageUploadError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    console.error('[CHAPTER_IMAGE_POST]', error);
    return NextResponse.json(
      { error: 'Failed to upload chapter image' },
      { status: 500 }
    );
  }
}
