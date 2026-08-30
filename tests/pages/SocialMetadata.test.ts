jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    chapter: { findFirst: jest.fn() },
    project: { findUnique: jest.fn() },
  },
}));

jest.mock(
  '../../src/app/projects/[projectId]/ProjectDetailClient',
  () => () => null
);

import { generateMetadata as generateChapterMetadata } from '../../src/app/chapters/[chapterSlug]/layout';
import { generateMetadata as generateProjectMetadata } from '../../src/app/projects/[projectId]/page';
import { metadata as rootMetadata } from '../../src/app/layout';
import prisma from '@/lib/prisma';
import { DEFAULT_SOCIAL_IMAGE_URL, publicUrl } from '@/lib/siteUrl';

const mockChapterFindFirst = prisma.chapter.findFirst as jest.Mock;
const mockProjectFindUnique = prisma.project.findUnique as jest.Mock;

describe('chapter and project link preview metadata', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('uses the chapter image for a public chapter link preview', async () => {
    mockChapterFindFirst.mockResolvedValue({
      name: 'Sundai Boston',
      description: 'Boston builders and events.',
      heroImage: {
        url: 'https://cdn.example.com/boston-chapter.webp',
        alt: 'Boston chapter artwork',
      },
    });

    const metadata = await generateChapterMetadata({
      params: { chapterSlug: 'boston' },
    });

    expect(metadata.openGraph?.url).toBe(publicUrl('/chapters/boston'));
    expect(metadata.alternates?.canonical).toBe(
      publicUrl('/chapters/boston')
    );
    expect(metadata.openGraph?.images).toEqual([
      {
        url: 'https://cdn.example.com/boston-chapter.webp',
        alt: 'Boston chapter artwork',
      },
    ]);
    expect(metadata.twitter?.images).toEqual([
      'https://cdn.example.com/boston-chapter.webp',
    ]);
  });

  it('uses the Sundai social card when a chapter has no image', async () => {
    mockChapterFindFirst.mockResolvedValue({
      name: 'Sundai Boston',
      description: null,
      heroImage: null,
    });

    const metadata = await generateChapterMetadata({
      params: { chapterSlug: 'boston' },
    });

    expect(metadata.openGraph?.images).toEqual([
      {
        url: DEFAULT_SOCIAL_IMAGE_URL,
        width: 1200,
        height: 630,
        type: 'image/png',
        alt: 'Sundai Club Logo',
      },
    ]);
  });

  it('uses the project thumbnail for a project link preview', async () => {
    mockProjectFindUnique.mockResolvedValue({
      title: 'Agent Toolkit',
      preview: 'Tools for building agents.',
      thumbnail: {
        url: 'https://cdn.example.com/agent-toolkit.webp',
      },
    });

    const metadata = await generateProjectMetadata({
      params: { projectId: 'project-agent-toolkit' },
    });

    expect(metadata.openGraph?.images).toEqual([
      {
        url: 'https://cdn.example.com/agent-toolkit.webp',
        alt: 'Agent Toolkit',
      },
    ]);
    expect(metadata.twitter?.images).toEqual([
      'https://cdn.example.com/agent-toolkit.webp',
    ]);
  });
});

describe('root link preview metadata', () => {
  it('uses the configured public app URL for social images', () => {
    const expectedBase = new URL(
      process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.sundai.club'
    );

    expect(rootMetadata.metadataBase).toEqual(expectedBase);
    expect(rootMetadata.alternates?.canonical).toBe(expectedBase.toString());
    expect(rootMetadata.openGraph?.url).toBe(expectedBase.toString());
    expect(rootMetadata.openGraph?.images).toEqual([
      {
        url: DEFAULT_SOCIAL_IMAGE_URL,
        width: 1200,
        height: 630,
        type: 'image/png',
        alt: 'Sundai Club Logo',
      },
    ]);
    expect(rootMetadata.twitter?.images).toEqual([
      DEFAULT_SOCIAL_IMAGE_URL,
    ]);
  });
});
