import type { Metadata } from 'next';
import prisma from '@/lib/prisma';
import { DEFAULT_SOCIAL_IMAGE_URL } from '@/lib/siteUrl';

const DEFAULT_SOCIAL_IMAGE = {
  url: DEFAULT_SOCIAL_IMAGE_URL,
  width: 1200,
  height: 630,
  alt: 'Sundai Club Logo',
};

type ChapterLayoutProps = {
  children: React.ReactNode;
  params: { chapterSlug: string };
};

export async function generateMetadata({
  params,
}: Pick<ChapterLayoutProps, 'params'>): Promise<Metadata> {
  const chapter = await prisma.chapter.findFirst({
    where: {
      slug: params.chapterSlug,
      status: 'ACTIVE',
      accessMode: 'PUBLIC',
    },
    select: {
      name: true,
      description: true,
      heroImage: {
        select: { url: true, alt: true },
      },
    },
  });

  if (!chapter) {
    return { title: 'Chapter Not Found | Sundai Club' };
  }

  const title = `${chapter.name} | Sundai Club`;
  const description =
    chapter.description || `Events and projects from ${chapter.name}.`;
  const image = chapter.heroImage?.url
    ? {
        url: chapter.heroImage.url,
        alt: chapter.heroImage.alt || `${chapter.name} chapter`,
      }
    : DEFAULT_SOCIAL_IMAGE;

  return {
    title,
    description,
    openGraph: {
      type: 'website',
      siteName: 'Sundai Club',
      title,
      description,
      images: [image],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image.url],
    },
  };
}

export default function ChapterLayout({ children }: ChapterLayoutProps) {
  return children;
}
