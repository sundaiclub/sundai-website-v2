import { NextResponse } from 'next/server';
import { requireEventMaterialsManager } from '@/lib/eventManagementApi';
import {
  createEventMaterialUploadIntent,
  validateEventMaterialUpload,
} from '@/lib/eventMaterials';

function storageUnavailable(error: unknown) {
  return (
    error instanceof Error &&
    /GOOGLE_|credential|bucket|signed url/i.test(error.message)
  );
}

export async function POST(
  request: Request,
  props: { params: Promise<{ eventId: string }> }
) {
  const params = await props.params;
  try {
    const access = await requireEventMaterialsManager(params.eventId);
    if (access.response) return access.response;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Request body must be valid JSON.' },
        { status: 400 }
      );
    }

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Upload metadata is required.' },
        { status: 400 }
      );
    }

    const { filename, mimeType, size } = body as Record<string, unknown>;
    if (
      typeof filename !== 'string' ||
      typeof mimeType !== 'string' ||
      typeof size !== 'number'
    ) {
      return NextResponse.json(
        { error: 'filename, mimeType, and size are required.' },
        { status: 400 }
      );
    }

    const validation = validateEventMaterialUpload({
      filename,
      mimeType,
      size,
    });
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error ?? 'Upload is not allowed.' },
        { status: 400 }
      );
    }

    const intent = await createEventMaterialUploadIntent({
      filename,
      mimeType,
      size,
    });
    return NextResponse.json(intent, { status: 201 });
  } catch (error) {
    if (storageUnavailable(error)) {
      console.error('[EVENT_MATERIAL_UPLOAD_INTENT_PROVIDER]', error);
      return NextResponse.json(
        { error: 'Material storage is unavailable.' },
        { status: 503 }
      );
    }
    console.error('[EVENT_MATERIAL_UPLOAD_INTENT_POST]', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
