// Public fields for the event cards on the /ideas and /guide pickers.
export const EVENT_PICKER_SELECT = {
  id: true,
  title: true,
  slug: true,
  startTime: true,
  endTime: true,
  timezone: true,
  publicLocation: true,
  image: { select: { url: true, alt: true } },
  chapter: { select: { name: true, slug: true } },
} as const;

type EventPickerRecord = {
  id: string;
  title: string;
  slug: string;
  startTime: Date;
  endTime: Date | null;
  timezone: string;
  publicLocation: string | null;
  image: { url: string; alt: string | null } | null;
  chapter: { name: string; slug: string };
};

export type EventPickerItem = ReturnType<typeof toEventPickerItem>;

export function toEventPickerItem({ chapter, ...event }: EventPickerRecord) {
  return { ...event, chapterName: chapter.name, chapterSlug: chapter.slug };
}

export function eventTabPath(
  event: Pick<EventPickerItem, 'chapterSlug' | 'slug'>,
  tab: string
) {
  return `/events/${encodeURIComponent(event.chapterSlug)}/${encodeURIComponent(event.slug)}?tab=${tab}`;
}
