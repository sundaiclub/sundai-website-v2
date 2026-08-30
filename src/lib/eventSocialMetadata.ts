import prisma from '@/lib/prisma';

export async function getPublicEventSocialMetadata({
  chapterSlug,
  eventSlug,
}: {
  chapterSlug: string;
  eventSlug: string;
}) {
  const event = await prisma.event.findFirst({
    where: {
      slug: eventSlug,
      status: 'PUBLISHED',
      visibility: 'PUBLIC',
      chapter: {
        slug: chapterSlug,
        status: 'ACTIVE',
        accessMode: 'PUBLIC',
      },
    },
    select: {
      id: true,
      title: true,
      description: true,
      image: {
        select: {
          id: true,
          url: true,
          alt: true,
        },
      },
      chapter: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!event) return null;

  return {
    id: event.id,
    title: event.title,
    description: event.description,
    image: event.image,
    chapterName: event.chapter.name,
  };
}
