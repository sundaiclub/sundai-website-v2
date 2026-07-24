import { NextResponse } from 'next/server';
import { getCurrentHacker } from '@/lib/eventManagementApi';
import { updateChapterNotificationPreferences } from '@/lib/chapters';
import type { JsonObject } from '@/types/event-management';

export async function PATCH(
  req: Request,
  { params }: { params: { chapterId: string } }
) {
  try {
    const hacker = await getCurrentHacker();
    if (!hacker) return new NextResponse('Unauthorized', { status: 401 });

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { message: 'Request body must be valid JSON.' },
        { status: 400 }
      );
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json(
        { message: 'Notification preferences are required.' },
        { status: 400 }
      );
    }

    const preferences = body as Record<string, unknown>;
    for (const field of [
      'notificationsAllowed',
      'emailNotificationsEnabled',
    ]) {
      if (
        preferences[field] !== undefined &&
        typeof preferences[field] !== 'boolean'
      ) {
        return NextResponse.json(
          { message: `${field} must be a boolean.` },
          { status: 400 }
        );
      }
    }

    const membership = await updateChapterNotificationPreferences(
      params.chapterId,
      hacker.id,
      {
        notificationsAllowed: preferences.notificationsAllowed as
          | boolean
          | undefined,
        emailNotificationsEnabled: preferences.emailNotificationsEnabled as
          | boolean
          | undefined,
        notificationPreferencesJson:
          (preferences.notificationPreferencesJson as JsonObject | null) ??
          null,
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
    console.error('[CHAPTER_NOTIFICATIONS_PATCH]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
