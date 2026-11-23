import type { Role } from '@prisma/client';
import prisma from '@/lib/prisma';
import { eventDayKey } from '@/lib/eventDateTime';
import {
  ACTIVE_MEMBERSHIP_STATUS,
  CHAPTER_ADMIN_ROLE,
  isSiteAdminRole,
} from '@/lib/eventManagementAuth';
import { publicEventVisibilityWhere } from '@/lib/publicEvents';
import { EVENT_PICKER_SELECT, toEventPickerItem } from '@/lib/eventPicker';

const DAY_MS = 24 * 60 * 60 * 1000;
const GOOGLE_SLIDES_PATH =
  /^\/presentation\/d\/(e\/)?([A-Za-z0-9_-]+)(?:\/(?:edit|view|pub|embed|present|preview)?)?\/?$/;

/**
 * Turns a shared Google Slides link into its embeddable slideshow URL. Other
 * HTTPS links are embedded as they are.
 */
export function guideEmbedUrl(guideUrl: string): string {
  const url = new URL(guideUrl);
  const slides =
    url.hostname === 'docs.google.com'
      ? url.pathname.match(GOOGLE_SLIDES_PATH)
      : null;
  if (!slides) return url.toString();

  const [, published, id] = slides;
  return `https://docs.google.com/presentation/d/${published ?? ''}${id}/embed?start=false&loop=false&delayms=3000`;
}

/**
 * Lists the public events whose guide this member can open: events that have
 * not ended where they are approved, run the event, or administer the chapter.
 */
export async function listViewerGuideEvents(
  viewer: { id: string; role: Role | null },
  now = new Date()
) {
  const events = await prisma.event.findMany({
    where: {
      ...publicEventVisibilityWhere(),
      guideUrl: { not: null },
      OR: [
        { endTime: { gt: new Date(now.getTime() - DAY_MS) } },
        { endTime: null, startTime: { gt: new Date(now.getTime() - DAY_MS) } },
      ],
      ...(!isSiteAdminRole(viewer.role) && {
        AND: {
          OR: [
            {
              registrations: {
                some: {
                  hackerId: viewer.id,
                  status: 'APPROVED',
                  cancelledAt: null,
                },
              },
            },
            {
              staff: {
                some: { hackerId: viewer.id, role: { in: ['MC', 'CO_MC'] } },
              },
            },
            {
              chapter: {
                memberships: {
                  some: {
                    hackerId: viewer.id,
                    role: CHAPTER_ADMIN_ROLE,
                    status: ACTIVE_MEMBERSHIP_STATUS,
                  },
                },
              },
            },
          ],
        },
      }),
    },
    orderBy: [{ startTime: 'asc' }, { title: 'asc' }],
    select: EVENT_PICKER_SELECT,
  });

  return events
    .filter(
      event =>
        eventDayKey(event.endTime ?? event.startTime, event.timezone) >=
        eventDayKey(now, event.timezone)
    )
    .map(toEventPickerItem);
}
