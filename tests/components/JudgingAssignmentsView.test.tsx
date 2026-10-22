import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import JudgingAssignmentsView from '@/app/organizer/events/[eventId]/judging/JudgingAssignmentsView';
import type { JudgingAssignmentPreview } from '@/types/judging';

jest.mock('@/app/contexts/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light' }),
}));

const draft: JudgingAssignmentPreview = {
  published: false,
  judgesPerProject: 2,
  tracks: [
    { id: 'a', name: 'Track A' },
    { id: 'b', name: 'Track B' },
  ],
  judges: [
    { id: 'one', name: 'One judge', total: 2, trackCounts: { a: 1, b: 1 } },
  ],
  projects: [
    {
      id: 'project',
      title: 'A project',
      trackId: 'a',
      assigned: 1,
      completed: 0,
    },
  ],
  shortages: [{ trackId: 'a', trackName: 'Track A', eligible: 1, required: 2 }],
};

it('shows draft coverage and refreshes the roster without publishing', async () => {
  global.fetch = jest
    .fn()
    .mockResolvedValueOnce({ ok: true, json: async () => draft });
  render(<JudgingAssignmentsView eventId="event" />);
  expect(
    await screen.findByText(/Track A needs 2 judges but has 1/)
  ).toBeInTheDocument();
  expect(screen.getByText('Needs judges')).toBeInTheDocument();
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      ...draft,
      shortages: [],
      judges: [
        ...draft.judges,
        { id: 'two', name: 'Second judge', total: 1, trackCounts: { a: 1 } },
      ],
      projects: [{ ...draft.projects[0], assigned: 2 }],
    }),
  });
  fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
  expect(await screen.findByText('Second judge')).toBeInTheDocument();
  expect(
    screen.getByText('Every project has enough judges in this draft.')
  ).toBeInTheDocument();
  expect(screen.queryByText('Needs judges')).not.toBeInTheDocument();
  expect(global.fetch).toHaveBeenLastCalledWith(
    '/api/events/event/judging/assignments',
    { cache: 'no-store' }
  );
});

it('shows published assignments separately from completed reviews', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ ...draft, published: true, shortages: [] }),
  });
  render(<JudgingAssignmentsView eventId="event" />);
  await waitFor(() =>
    expect(
      screen.getByRole('heading', { name: 'Published assignments' })
    ).toBeInTheDocument()
  );
  for (const name of ['Required', 'Assigned', 'Complete'])
    expect(screen.getByRole('columnheader', { name })).toBeInTheDocument();
  expect(
    screen.queryByText('Every project has enough judges in this draft.')
  ).not.toBeInTheDocument();
});
