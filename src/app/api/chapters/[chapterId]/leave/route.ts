import { NextResponse } from 'next/server';
import { getCurrentHacker } from '@/lib/eventManagementApi';
import { leaveChapterWithAdminGuard } from '@/lib/chapters';

export async function POST(
  _req: Request,
  { params }: { params: { chapterId: string } }
) {
  try {
    const hacker = await getCurrentHacker();
    if (!hacker) return new NextResponse('Unauthorized', { status: 401 });

    const membership = await leaveChapterWithAdminGuard(params.chapterId, hacker.id);
    return NextResponse.json(membership);
  } catch (error: unknown) {
    if (error instanceof Error) {
      const status = (error as { status?: unknown }).status;
      if (typeof status === 'number') {
        return NextResponse.json({ message: error.message }, { status });
      }
    }
    console.error('[CHAPTER_LEAVE_POST]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
