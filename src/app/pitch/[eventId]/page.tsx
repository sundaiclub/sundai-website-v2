import { notFound, redirect } from 'next/navigation';
import prisma from '@/lib/prisma';

export default async function LegacyPitchEventPage(
  props: {
    params: Promise<{ eventId: string }>;
  }
) {
  const params = await props.params;
  const event = await prisma.event.findUnique({
    where: { id: params.eventId },
    select: {
      slug: true,
      chapter: { select: { slug: true } },
    },
  });

  if (!event) notFound();

  redirect(
    `/events/${encodeURIComponent(event.chapter.slug)}/${encodeURIComponent(event.slug)}?tab=pitch`
  );
}
