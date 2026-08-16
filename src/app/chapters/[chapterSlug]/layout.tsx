import type { Metadata } from 'next';
import prisma from '@/lib/prisma';
import { DEFAULT_SOCIAL_IMAGE_URL, publicUrl } from '@/lib/siteUrl';

const DEFAULT_SOCIAL_IMAGE = {
  url: DEFAULT_SOCIAL_IMAGE_URL,
  width: 1200,
  height: 630,
  type: 'image/png',
  alt: 'Sundai Club Logo',
};

type ChapterLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ chapterSlug: string }>;
};

export async function generateMetadata(
  props: Pick<ChapterLayoutProps, 'params'>
): Promise<Metadata> {
  const params = await props.params;
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
  const pageUrl = publicUrl(
    `/chapters/${encodeURIComponent(params.chapterSlug)}`
  );

  return {
    title,
    description,
    alternates: { canonical: pageUrl },
    openGraph: {
      type: 'website',
      url: pageUrl,
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
