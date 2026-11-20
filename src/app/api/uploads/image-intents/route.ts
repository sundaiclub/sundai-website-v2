import { auth } from '@clerk/nextjs/server';
import { privateJson } from '@/lib/publicData';
import { ImageUploadError, isImageUploadFolder } from '@/lib/imageUploads';
import { createImageUploadIntent } from '@/lib/s3-images';

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return privateJson({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return privateJson(
        { error: 'Upload details are required.' },
        { status: 400 }
      );
    }
    const { folder, filename, contentType, size } = body as Record<
      string,
      unknown
    >;
    if (
      !isImageUploadFolder(folder) ||
      typeof filename !== 'string' ||
      typeof contentType !== 'string' ||
      typeof size !== 'number'
    ) {
      return privateJson(
        { error: 'folder, filename, contentType, and size are required.' },
        { status: 400 }
      );
    }

    const intent = await createImageUploadIntent({
      folder,
      filename,
      contentType,
      size,
    });
    return privateJson(intent, { status: 201 });
  } catch (error) {
    if (error instanceof ImageUploadError) {
      return privateJson({ error: error.message }, { status: error.status });
    }
    console.error('[IMAGE_UPLOAD_INTENT_POST]', error);
    return privateJson(
      { error: 'Unable to start the image upload.' },
      { status: 500 }
    );
  }
}
