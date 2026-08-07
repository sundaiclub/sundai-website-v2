import {
  listPublicEventProjects,
  rankPublicEventProjects,
} from '@/lib/publicEventProjects';

function row(input: {
  id: string;
  title: string;
  votes: number[];
  createdAt: string;
}) {
  return {
    createdAt: input.createdAt,
    project: {
      id: input.id,
      title: input.title,
      preview: `${input.title} preview`,
      description: `${input.title} description`,
      githubUrl: null,
      demoUrl: null,
      blogUrl: null,
      startDate: new Date('2026-07-01T00:00:00.000Z'),
      endDate: null,
      status: 'APPROVED' as const,
      createdAt: new Date('2026-07-01T00:00:00.000Z'),
      updatedAt: new Date('2026-07-01T00:00:00.000Z'),
      is_starred: false,
      is_broken: false,
      thumbnail: null,
      launchLead: {
        id: `${input.id}-lead`,
        name: `${input.title} lead`,
        twitterUrl: null,
        linkedinUrl: null,
        avatar: null,
      },
      participants: [],
      techTags: [],
      domainTags: [],
      likes: [],
      pitchEntries: input.votes.map(voteCount => ({
        pitchVotes: Array.from({ length: voteCount }, (_, index) => ({
          id: `${input.id}-vote-${index}`,
        })),
      })),
    },
  };
}

describe('public event projects', () => {
  it('ranks all linked projects by total pitch likes across event sessions', () => {
    const projects = rankPublicEventProjects([
      row({
        id: 'project-low',
        title: 'Low',
        votes: [1],
        createdAt: '2026-07-03T00:00:00.000Z',
      }),
      row({
        id: 'project-high',
        title: 'High',
        votes: [2, 3],
        createdAt: '2026-07-02T00:00:00.000Z',
      }),
      row({
        id: 'project-none',
        title: 'None',
        votes: [],
        createdAt: '2026-07-01T00:00:00.000Z',
      }),
    ]);

    expect(
      projects.map(project => [project.id, project.pitchVoteCount])
    ).toEqual([
      ['project-high', 5],
      ['project-low', 1],
      ['project-none', 0],
    ]);
  });

  it('loads event-linked projects and excludes broken projects and banned votes', async () => {
    const findMany = jest.fn().mockResolvedValue([
      row({
        id: 'project-1',
        title: 'Project one',
        votes: [2],
        createdAt: '2026-07-01T00:00:00.000Z',
      }),
    ]);

    await expect(
      listPublicEventProjects({
        eventId: 'event-1',
        db: { eventProject: { findMany } },
      })
    ).resolves.toEqual([
      expect.objectContaining({ id: 'project-1', pitchVoteCount: 2 }),
    ]);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ eventId: 'event-1' }),
      })
    );
    const query = findMany.mock.calls[0][0];
    expect(query.where.project.is_broken).toBe(false);
    expect(
      query.select.project.select.pitchEntries.select.pitchVotes.where
    ).toEqual(
      expect.objectContaining({
        value: 'LIKE',
        hacker: { userBans: { none: { revokedAt: null } } },
      })
    );
  });
});
