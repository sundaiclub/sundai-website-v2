import React from 'react';
import { act, render, screen } from '@testing-library/react';
import EventJudgingPanel from '@/app/components/EventJudgingPanel';
import type { JudgePanelPayload } from '@/types/judging';

jest.mock('@/app/contexts/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light' }),
}));
jest.mock('@/app/components/ProjectMarkdown', () => ({
  __esModule: true,
  default: ({ markdown }: { markdown: string }) => <p>{markdown}</p>,
}));

const panel: JudgePanelPayload = {
  judge: { id: 'judge', name: 'Jo', email: 'jo@example.com' },
  judgingOpen: true,
  assignmentsPublished: true,
  scoreMin: 1,
  scoreMax: 5,
  tracks: [
    {
      id: 'a',
      name: 'A',
      description: null,
      criteria: ['idea', 'demo'].map(id => ({
        id,
        trackId: null,
        name: id,
        description: null,
        weight: 1,
      })),
      projects: [
        {
          submissionId: 's1',
          projectId: 'p1',
          trackId: 'a',
          title: 'Assigned project',
          preview: '',
          thumbnailUrl: null,
          githubUrl: null,
          demoUrl: null,
          blogUrl: null,
          team: [],
          answers: [],
          review: {
            scores: { idea: 4 },
            comment: '',
            updatedAt: '2026-10-22T12:00:00Z',
          },
        },
      ],
    },
  ],
};

it('does not count a partial review as complete', async () => {
  global.fetch = jest
    .fn()
    .mockResolvedValue({ ok: true, json: async () => panel });
  render(<EventJudgingPanel eventId="event" judgeToken="token" />);
  expect(await screen.findByText('Assigned project')).toBeInTheDocument();
  expect(
    screen.getByText(/0 of 1 assigned projects complete/)
  ).toBeInTheDocument();
  expect(global.fetch).toHaveBeenCalledWith(
    '/api/judging/event',
    expect.objectContaining({ headers: { 'x-judge-token': 'token' } })
  );
});

it('waits for publication and then loads the assigned list', async () => {
  jest.useFakeTimers();
  try {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...panel,
          assignmentsPublished: false,
          judgingOpen: false,
          tracks: [],
        }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => panel });
    render(<EventJudgingPanel eventId="event" judgeToken={null} />);
    await act(async () => {});
    expect(screen.getByText(/Judging has not started/)).toBeInTheDocument();
    expect(screen.queryByText('Assigned project')).not.toBeInTheDocument();
    await act(async () => {
      jest.advanceTimersByTime(15000);
    });
    expect(screen.getByText('Assigned project')).toBeInTheDocument();
  } finally {
    jest.useRealTimers();
  }
});
