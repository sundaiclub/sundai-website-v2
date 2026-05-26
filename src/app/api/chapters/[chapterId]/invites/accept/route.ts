import { NextResponse } from 'next/server';
import { getCurrentHacker } from '@/lib/eventManagementApi';
import { acceptPrivateChapterInvite } from '@/lib/chapters';

export async function POST(
  _req: Request,
  { params }: { params: { chapterId: string } }
) {
  try {
    const hacker = await getCurrentHacker();
    if (!hacker) return new NextResponse('Unauthorized', { status: 401 });

    const membership = await acceptPrivateChapterInvite(params.chapterId, hacker.id, {
      notificationsAllowed: true,
      emailNotificationsEnabled: true,
    });

    return NextResponse.json(membership);
  } catch (error: any) {
    if (error?.status) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    console.error('[CHAPTER_INVITE_ACCEPT_POST]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
