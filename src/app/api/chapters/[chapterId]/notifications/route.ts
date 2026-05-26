import { NextResponse } from 'next/server';
import { getCurrentHacker } from '@/lib/eventManagementApi';
import { updateChapterNotificationPreferences } from '@/lib/chapters';

export async function PATCH(
  req: Request,
  { params }: { params: { chapterId: string } }
) {
  try {
    const hacker = await getCurrentHacker();
    if (!hacker) return new NextResponse('Unauthorized', { status: 401 });

    const body = await req.json();
    const membership = await updateChapterNotificationPreferences(
      params.chapterId,
      hacker.id,
      {
        notificationsAllowed: body?.notificationsAllowed,
        emailNotificationsEnabled: body?.emailNotificationsEnabled,
        smsNotificationsEnabled: body?.smsNotificationsEnabled,
        notificationPreferencesJson: body?.notificationPreferencesJson ?? null,
      }
    );

    return NextResponse.json(membership);
  } catch (error: any) {
    if (error?.status) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    console.error('[CHAPTER_NOTIFICATIONS_PATCH]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
