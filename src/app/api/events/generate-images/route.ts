import { NextResponse } from 'next/server';
import { generatePixelArtImages } from '@/lib/aiImageGeneration';
import { requireChapterManager } from '@/lib/eventManagementApi';

export async function POST(req: Request) {
  try {
    const body: unknown = await req.json();
    if (!body || typeof body !== 'object') {
      return new NextResponse('Event details are required', { status: 400 });
    }

    const chapterId = 'chapterId' in body ? body.chapterId : undefined;
    const title = 'title' in body ? body.title : undefined;
    const description = 'description' in body ? body.description : undefined;
    if (typeof chapterId !== 'string' || chapterId.trim().length === 0) {
      return new NextResponse('Chapter is required', { status: 400 });
    }
    if (typeof title !== 'string' || title.trim().length === 0) {
      return new NextResponse('Title is required', { status: 400 });
    }
    if (typeof description !== 'string' || description.trim().length === 0) {
      return new NextResponse('Description is required', { status: 400 });
    }

    const access = await requireChapterManager(chapterId);
    if (access.response) return access.response;

    const images = await generatePixelArtImages(`Event: ${title.trim()}
Description: ${description.trim()}

User Request: Generate pixel-art event artwork based on the event description.`);

    return NextResponse.json({ images });
  } catch (error) {
    console.error('[GENERATE_EVENT_IMAGES]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
