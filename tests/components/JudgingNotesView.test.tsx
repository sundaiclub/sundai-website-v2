import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import JudgingNotesView from '@/app/organizer/events/[eventId]/judging/JudgingNotesView';
import type { JudgingLeaderboardRow, JudgingResults } from '@/types/judging';

jest.mock('@/app/contexts/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light' }),
}));

function row(
  overrides: Partial<JudgingLeaderboardRow> &
    Pick<JudgingLeaderboardRow, 'submissionId' | 'title' | 'trackId'>
): JudgingLeaderboardRow {
  return {
    projectId: `${overrides.submissionId}-project`,
    trackName: overrides.trackId === 'a' ? 'Track A' : 'Track B',
    judgeCount: 0,
    assignedJudgeCount: 0,
    requiredJudgeCount: 2,
    rawScore: null,
    normalizedScore: null,
    criterionAverages: {},
    reviews: [],
    ...overrides,
  };
}

const results: JudgingResults = {
  scoreMin: 1,
  scoreMax: 10,
  overall: [
    row({
      submissionId: 'zeta',
      title: 'Zeta',
      trackId: 'b',
      reviews: [
        {
          judgeId: 'ann',
          judgeName: 'Ann',
          score: null,
          scores: {},
          comment: 'Needs a clearer demo',
        },
      ],
    }),
    row({
      submissionId: 'alpha',
      title: 'Alpha',
      trackId: 'a',
      reviews: [
        {
          judgeId: 'ann',
          judgeName: 'Ann',
          score: 8.5,
          scores: {},
          comment: 'Strong pitch',
        },
        {
          judgeId: 'bob',
          judgeName: 'Bob',
          score: 7,
          scores: {},
          comment: 'Great use of the API',
        },
      ],
    }),
    row({
      submissionId: 'silent',
      title: 'Silent',
      trackId: 'a',
      reviews: [
        {
          judgeId: 'bob',
          judgeName: 'Bob',
          score: 6,
          scores: {},
          comment: '   ',
        },
      ],
    }),
  ],
  tracks: [
    { id: 'a', name: 'Track A', criteria: [], rows: [] },
    { id: 'b', name: 'Track B', criteria: [], rows: [] },
  ],
};

beforeEach(() => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => results,
  });
});

it('lists notes by project, skipping blank notes', async () => {
  render(<JudgingNotesView eventId="event-1" />);
  expect(await screen.findByText('Strong pitch')).toBeInTheDocument();
  expect(global.fetch).toHaveBeenCalledWith(
    '/api/events/event-1/judging/results',
    { cache: 'no-store' }
  );
  expect(screen.getByRole('status')).toHaveTextContent(
    '3 notes across 2 projects'
  );
  expect(
    screen.getAllByRole('heading').map(heading => heading.textContent)
  ).toEqual(['Judge notes', 'AlphaTrack A', 'ZetaTrack B']);
  expect(screen.queryByText('Silent')).not.toBeInTheDocument();
  expect(screen.getByText('Ann · Review in progress')).toBeInTheDocument();
});

it('filters notes by judge, track, and search text', async () => {
  render(<JudgingNotesView eventId="event-1" />);
  await screen.findByText('Strong pitch');

  fireEvent.change(screen.getByLabelText('Judge'), {
    target: { value: 'bob' },
  });
  expect(screen.getByText('Great use of the API')).toBeInTheDocument();
  expect(screen.queryByText('Strong pitch')).not.toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('Judge'), {
    target: { value: 'all' },
  });
  fireEvent.change(screen.getByLabelText('Track'), {
    target: { value: 'b' },
  });
  expect(screen.getByText('Needs a clearer demo')).toBeInTheDocument();
  expect(screen.queryByText('Strong pitch')).not.toBeInTheDocument();

  fireEvent.change(screen.getByLabelText('Search notes'), {
    target: { value: 'nothing matches' },
  });
  expect(screen.getByText('No notes match these filters.')).toBeInTheDocument();
});

it('shows an empty state when no judge has left notes', async () => {
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => ({ ...results, overall: [] }),
  });
  render(<JudgingNotesView eventId="event-1" />);
  expect(await screen.findByText('No judge notes yet.')).toBeInTheDocument();
});
