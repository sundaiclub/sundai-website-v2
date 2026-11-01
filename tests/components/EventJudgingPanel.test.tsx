import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
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
  requireGithubUrl: false,
  scoreMin: 1,
  scoreMax: 10,
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

beforeEach(() => {
  window.history.replaceState(
    null,
    '',
    '/events/boston/hackathon?tab=judging&judge=token#scores'
  );
  window.scrollTo = jest.fn();
});

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

const assignedPanel: JudgePanelPayload = {
  ...panel,
  tracks: ['a', 'b'].map(id => ({
    ...panel.tracks[0],
    id,
    name: id.toUpperCase(),
    projects: [1, 2].map(number => ({
      ...panel.tracks[0].projects[0],
      submissionId: `${id}-${number}`,
      title: `Project ${id}-${number}`,
      review: null,
    })),
  })),
};

it('restores the track and project on refresh and updates the URL when navigating', async () => {
  window.history.replaceState(
    null,
    '',
    '?tab=judging&track=b&project=2&judge=token#scores'
  );
  global.fetch = jest
    .fn()
    .mockResolvedValue({ ok: true, json: async () => assignedPanel });
  const view = render(<EventJudgingPanel eventId="event" judgeToken="token" />);
  expect(await screen.findByText('Project b-2')).toBeInTheDocument();
  fireEvent.click(
    screen.getAllByRole('button', { name: /Previous project/ })[0]
  );
  expect(await screen.findByText('Project b-1')).toBeInTheDocument();
  expect(window.location.search).toBe(
    '?tab=judging&track=b&project=1&judge=token'
  );
  expect(window.location.hash).toBe('#scores');

  view.unmount();
  render(<EventJudgingPanel eventId="event" judgeToken="token" />);
  expect(await screen.findByText('Project b-1')).toBeInTheDocument();
  fireEvent.click(screen.getAllByRole('button', { name: /Next project/ })[0]);
  expect(await screen.findByText('Project b-2')).toBeInTheDocument();
  expect(new URLSearchParams(window.location.search).get('project')).toBe('2');
  fireEvent.click(screen.getByRole('button', { name: /Judge A/ }));
  expect(await screen.findByText('Project a-1')).toBeInTheDocument();
  expect(window.location.search).toBe(
    '?tab=judging&track=a&project=1&judge=token'
  );
});

it.each(['', '0', '-1', '3', '1.5', 'invalid'])(
  'defaults to the first assigned project for invalid project=%s',
  async project => {
    window.history.replaceState(
      null,
      '',
      `?tab=judging&track=missing&project=${project}`
    );
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: true, json: async () => assignedPanel });
    render(<EventJudgingPanel eventId="event" judgeToken={null} />);
    expect(await screen.findByText('Project a-1')).toBeInTheDocument();
  }
);

it('keeps the URL unchanged when saving before navigation fails', async () => {
  global.fetch = jest
    .fn()
    .mockResolvedValueOnce({ ok: true, json: async () => assignedPanel })
    .mockResolvedValue({
      ok: false,
      json: async () => ({ message: 'Save failed' }),
    });
  render(<EventJudgingPanel eventId="event" judgeToken="token" />);
  expect(await screen.findByText('Project a-1')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'demo: 5' }));
  const url = window.location.href;
  fireEvent.click(screen.getAllByRole('button', { name: /Save & next/ })[0]);
  expect(await screen.findByText('Save failed')).toBeInTheDocument();
  expect(window.location.href).toBe(url);
  expect(screen.getByText('Project a-1')).toBeInTheDocument();
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
