import { NextResponse } from 'next/server';
import { fetchMergedApplicationTemplate } from '@/lib/applicationTemplates';
import { getCurrentHacker, isSiteAdmin } from '@/lib/eventManagementApi';
import { canManageChapterSettings, canManageEventSettings } from '@/lib/eventManagementAuth';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const hacker = await getCurrentHacker();
    if (!hacker) return new NextResponse('Unauthorized', { status: 401 });

    const url = new URL(req.url);
    const chapterId = url.searchParams.get('chapterId');
    const eventId = url.searchParams.get('eventId');

    const allowed =
      isSiteAdmin(hacker) ||
      (chapterId && (await canManageChapterSettings(prisma, hacker.id, chapterId))) ||
      (eventId && (await canManageEventSettings(prisma, hacker.id, eventId)));
    if (!allowed) return new NextResponse('Forbidden', { status: 403 });

    const merged = await fetchMergedApplicationTemplate({
      chapterId,
      eventId,
    });

    return NextResponse.json(merged);
  } catch (error) {
    if (error instanceof Error && error.name === 'ApplicationTemplateValidationError') {
      return NextResponse.json(
        { message: error.message, issues: (error as any).issues },
        { status: 400 }
      );
    }
    console.error('[APPLICATION_TEMPLATE_MERGED_GET]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
