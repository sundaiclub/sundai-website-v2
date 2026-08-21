import { Metadata } from 'next';
import prisma from '@/lib/prisma';
import { DEFAULT_SOCIAL_IMAGE_URL, publicUrl } from '@/lib/siteUrl';
import ProjectDetailClient from './ProjectDetailClient';

type Props = {
  params: Promise<{ projectId: string }>;
};

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params;
  const project = await prisma.project.findUnique({
    where: { id: params.projectId },
    include: { thumbnail: true },
  });

  if (!project) {
    return {
      title: 'Project Not Found | Sundai Club',
    };
  }

  const title = `${project.title} | Sundai Club`;
  const description = project.preview || 'A project built at Sundai Club';
  const images = project.thumbnail?.url
    ? [{ url: project.thumbnail.url, alt: project.title }]
    : [
        {
          url: DEFAULT_SOCIAL_IMAGE_URL,
          width: 1200,
          height: 630,
          type: 'image/png',
          alt: 'Sundai Club Logo',
        },
      ];

  return {
    title,
    description,
    alternates: {
      canonical: publicUrl(`/projects/${encodeURIComponent(params.projectId)}`),
    },
    openGraph: {
      type: 'article',
      url: publicUrl(`/projects/${encodeURIComponent(params.projectId)}`),
      title,
      description,
      siteName: 'Sundai Club',
      images,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: images.map(img => img.url),
    },
  };
}

export default function ProjectDetailPage() {
  return <ProjectDetailClient />;
}
