jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    event: { findFirst: jest.fn() },
  },
}));

import prisma from '@/lib/prisma';
import { getPublicEventSocialMetadata } from '@/lib/eventSocialMetadata';

const mockEventFindFirst = prisma.event.findFirst as jest.Mock;

describe('event social metadata', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('gets only the public fields needed for a link preview', async () => {
    mockEventFindFirst.mockResolvedValue({
      id: 'event-1',
      title: 'AI Build Night',
      description: 'Build an AI project with the Boston chapter.',
      image: {
        id: 'image-1',
        url: 'https://cdn.example.com/event.webp',
        alt: 'AI Build Night artwork',
      },
      chapter: { name: 'Sundai Boston' },
    });

    await expect(
      getPublicEventSocialMetadata({
        chapterSlug: 'boston',
        eventSlug: 'ai-build-night',
      })
    ).resolves.toEqual({
      id: 'event-1',
      title: 'AI Build Night',
      description: 'Build an AI project with the Boston chapter.',
      image: {
        id: 'image-1',
        url: 'https://cdn.example.com/event.webp',
        alt: 'AI Build Night artwork',
      },
      chapterName: 'Sundai Boston',
    });

    expect(mockEventFindFirst).toHaveBeenCalledWith({
      where: {
        slug: 'ai-build-night',
        status: 'PUBLISHED',
        visibility: 'PUBLIC',
        chapter: {
          slug: 'boston',
          status: 'ACTIVE',
          accessMode: 'PUBLIC',
        },
      },
      select: {
        id: true,
        title: true,
        description: true,
        image: { select: { id: true, url: true, alt: true } },
        chapter: { select: { name: true } },
      },
    });
  });
});
