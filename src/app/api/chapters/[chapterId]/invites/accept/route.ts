import { NextResponse } from 'next/server';
import { getCurrentHacker } from '@/lib/eventManagementApi';
import { acceptPrivateChapterInvite } from '@/lib/chapters';

export async function POST(
  _req: Request,
  props: { params: Promise<{ chapterId: string }> }
) {
  const params = await props.params;
  try {
    const hacker = await getCurrentHacker();
    if (!hacker) return new NextResponse('Unauthorized', { status: 401 });

    const membership = await acceptPrivateChapterInvite(
      params.chapterId,
      hacker.id,
      {
        notificationsAllowed: true,
        emailNotificationsEnabled: true,
      }
    );

    return NextResponse.json(membership);
  } catch (error: unknown) {
    if (error instanceof Error) {
      const status = (error as { status?: unknown }).status;
      if (typeof status === 'number') {
        return NextResponse.json({ message: error.message }, { status });
      }
    }
    console.error('[CHAPTER_INVITE_ACCEPT_POST]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
