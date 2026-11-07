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

/** Answers panel loads with `panels` in turn (repeating the last), score
 * saves with `saved`, and open-project reports with `viewingStatus`. */
function mockJudgingApi(
  panels: JudgePanelPayload[],
  saved?: { status?: number; body: unknown },
  viewingStatus: () => number = () => 204
) {
  let loads = 0;
  global.fetch = jest.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/viewing')) {
      const status = viewingStatus();
      return { ok: status < 400, status, json: async () => null };
    }
    if (init?.method === 'PUT') {
      const status = saved?.status ?? 200;
      return {
        ok: status < 400,
        status,
        json: async () => saved?.body,
      };
    }
    const payload = panels[Math.min(loads, panels.length - 1)];
    loads += 1;
    return { ok: true, status: 200, json: async () => payload };
  }) as jest.Mock;
}

const panelLoads = () =>
  (global.fetch as jest.Mock).mock.calls.filter(
    ([url]) => url === '/api/judging/event'
  ).length;
const viewingReports = () =>
  (global.fetch as jest.Mock).mock.calls
    .filter(([url]) => url === '/api/judging/event/viewing')
    .map(([, init]) => JSON.parse(init.body).submissionId);

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
    '?tab=judging&track=b&project=b-2&judge=token#scores'
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
    '?tab=judging&track=b&project=b-1&judge=token'
  );
  expect(window.location.hash).toBe('#scores');

  view.unmount();
  render(<EventJudgingPanel eventId="event" judgeToken="token" />);
  expect(await screen.findByText('Project b-1')).toBeInTheDocument();
  fireEvent.click(screen.getAllByRole('button', { name: /Next project/ })[0]);
  fireEvent.click(
    screen.getByRole('button', { name: 'Continue to next project anyway' })
  );
  expect(await screen.findByText('Project b-2')).toBeInTheDocument();
  expect(new URLSearchParams(window.location.search).get('project')).toBe(
    'b-2'
  );
  fireEvent.click(screen.getByRole('button', { name: /Judge A/ }));
  expect(await screen.findByText('Project a-1')).toBeInTheDocument();
  expect(window.location.search).toBe(
    '?tab=judging&track=a&project=a-1&judge=token'
  );
});

it.each(['', '2', 'invalid'])(
  'defaults to the first assigned project for unknown project=%s',
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
    expect(window.location.search).toBe('?tab=judging&track=a&project=a-1');
  }
);

it('never opens a project from the URL that is not assigned to the judge', async () => {
  window.history.replaceState(
    null,
    '',
    '?tab=judging&track=b&project=someone-elses&judge=token'
  );
  mockJudgingApi([withScores(['b-1'])]);
  render(<EventJudgingPanel eventId="event" judgeToken="token" />);
  expect(await screen.findByText('Project b-2')).toBeInTheDocument();
  expect(
    screen.getByText(
      'That project is not assigned to you, so you are on your next project instead.'
    )
  ).toBeInTheDocument();
  expect(window.location.search).toBe(
    '?tab=judging&track=b&project=b-2&judge=token'
  );
  expect(viewingReports()).toEqual(['b-2']);
});

const scored = { idea: 5, demo: 5 };

function withScores(scoredIds: string[]): JudgePanelPayload {
  return {
    ...assignedPanel,
    tracks: assignedPanel.tracks.map(track => ({
      ...track,
      projects: track.projects.map(project => ({
        ...project,
        review: scoredIds.includes(project.submissionId)
          ? { scores: scored, comment: '', updatedAt: '2026-10-22T12:00:00Z' }
          : null,
      })),
    })),
  };
}

it.each([
  ['', ['a-1'], 'Project a-2'],
  ['', ['a-1', 'a-2'], 'Project b-1'],
  ['', ['a-1', 'a-2', 'b-1', 'b-2'], 'Project a-1'],
  ['&track=b', ['b-1'], 'Project b-2'],
  ['&track=b', ['a-1', 'b-1', 'b-2'], 'Project a-2'],
])(
  'opens the first unscored project when the URL has no project (%s, scored %j)',
  async (query, scoredIds, expected) => {
    window.history.replaceState(null, '', `?tab=judging${query}`);
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: true, json: async () => withScores(scoredIds) });
    render(<EventJudgingPanel eventId="event" judgeToken={null} />);
    expect(await screen.findByText(expected)).toBeInTheDocument();
  }
);

it('keeps the URL project on refresh even when it is already scored', async () => {
  window.history.replaceState(null, '', '?tab=judging&track=a&project=a-1');
  global.fetch = jest
    .fn()
    .mockResolvedValue({ ok: true, json: async () => withScores(['a-1']) });
  render(<EventJudgingPanel eventId="event" judgeToken={null} />);
  expect(await screen.findByText('Project a-1')).toBeInTheDocument();
});

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
  fireEvent.click(
    screen.getByRole('button', { name: 'Continue to next project anyway' })
  );
  expect(await screen.findByText('Save failed')).toBeInTheDocument();
  expect(window.location.href).toBe(url);
  expect(screen.getByText('Project a-1')).toBeInTheDocument();
});

it('confirms a save and offers the next project beside the save button', async () => {
  mockJudgingApi([assignedPanel], {
    body: {
      scores: { demo: 5 },
      comment: '',
      updatedAt: '2026-10-22T12:00:00Z',
    },
  });
  render(<EventJudgingPanel eventId="event" judgeToken="token" />);
  expect(await screen.findByText('Project a-1')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'demo: 5' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save scores' }));
  expect(
    await screen.findByText('Scores for Project a-1 saved successfully.')
  ).toBeInTheDocument();
  const nextButtons = screen.getAllByRole('button', { name: /Next project/ });
  fireEvent.click(nextButtons[nextButtons.length - 1]);
  fireEvent.click(
    screen.getByRole('button', { name: 'Continue to next project anyway' })
  );
  expect(await screen.findByText('Project a-2')).toBeInTheDocument();
});

it('warns about missing criteria before moving on and lets the judge stay', async () => {
  global.fetch = jest
    .fn()
    .mockResolvedValue({ ok: true, json: async () => assignedPanel });
  render(<EventJudgingPanel eventId="event" judgeToken="token" />);
  expect(await screen.findByText('Project a-1')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'demo: 5' }));
  fireEvent.click(screen.getAllByRole('button', { name: /Save & next/ })[0]);
  const dialog = screen.getByRole('alertdialog');
  expect(dialog).toHaveTextContent('idea');
  expect(dialog).not.toHaveTextContent(/\bdemo\b/);
  expect(dialog).toHaveTextContent("otherwise your score won't count");
  fireEvent.click(
    screen.getByRole('button', { name: 'Stay and finish scoring' })
  );
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  expect(screen.getByText('Project a-1')).toBeInTheDocument();
  expect(panelLoads()).toBe(1);
  expect(global.fetch).not.toHaveBeenCalledWith(
    expect.stringContaining('/reviews/'),
    expect.anything()
  );
});

it('moves on without a warning once every criterion is scored', async () => {
  mockJudgingApi([assignedPanel], {
    body: { scores: scored, comment: '', updatedAt: '2026-10-22T12:00:00Z' },
  });
  render(<EventJudgingPanel eventId="event" judgeToken="token" />);
  expect(await screen.findByText('Project a-1')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'idea: 5' }));
  fireEvent.click(screen.getByRole('button', { name: 'demo: 5' }));
  fireEvent.click(screen.getAllByRole('button', { name: /Save & next/ })[0]);
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  expect(await screen.findByText('Project a-2')).toBeInTheDocument();
});

const withProjects = (ids: string[]): JudgePanelPayload => ({
  ...assignedPanel,
  tracks: [
    {
      ...assignedPanel.tracks[0],
      projects: ids.map(id => ({
        ...assignedPanel.tracks[0].projects[0],
        submissionId: id,
        title: `Project ${id}`,
      })),
    },
  ],
});

it('reloads assignments on every move and skips projects given to another judge', async () => {
  mockJudgingApi([
    withProjects(['a-1', 'a-2', 'a-3']),
    withProjects(['a-1', 'a-3', 'a-4']),
  ]);
  render(<EventJudgingPanel eventId="event" judgeToken="token" />);
  expect(await screen.findByText('Project a-1')).toBeInTheDocument();
  fireEvent.click(screen.getAllByRole('button', { name: /Next project/ })[0]);
  fireEvent.click(
    screen.getByRole('button', { name: 'Continue to next project anyway' })
  );
  expect(await screen.findByText('Project a-3')).toBeInTheDocument();
  expect(screen.getAllByText('Project 2 of 3')[0]).toBeInTheDocument();
  expect(window.location.search).toContain('project=a-3');
  expect(panelLoads()).toBe(2);
});

it('reports each project the judge opens so it is never moved away', async () => {
  mockJudgingApi([assignedPanel]);
  render(<EventJudgingPanel eventId="event" judgeToken="token" />);
  expect(await screen.findByText('Project a-1')).toBeInTheDocument();
  fireEvent.click(screen.getAllByRole('button', { name: /Next project/ })[0]);
  fireEvent.click(
    screen.getByRole('button', { name: 'Continue to next project anyway' })
  );
  expect(await screen.findByText('Project a-2')).toBeInTheDocument();
  expect(viewingReports()).toEqual(['a-1', 'a-2']);
  expect(global.fetch).toHaveBeenCalledWith(
    '/api/judging/event/viewing',
    expect.objectContaining({
      method: 'PUT',
      headers: expect.objectContaining({ 'x-judge-token': 'token' }),
    })
  );
});

it('moves on when the project being opened was reassigned a moment earlier', async () => {
  let reports = 0;
  mockJudgingApi(
    [withProjects(['a-1', 'a-2']), withProjects(['a-2'])],
    undefined,
    () => (reports++ === 0 ? 404 : 204)
  );
  render(<EventJudgingPanel eventId="event" judgeToken="token" />);
  expect(await screen.findByText('Project a-2')).toBeInTheDocument();
  expect(screen.queryByText('Project a-1')).not.toBeInTheDocument();
  expect(
    screen.getByText(
      'That project was reassigned to another judge, so you are on your next project instead.'
    )
  ).toBeInTheDocument();
  expect(viewingReports()).toEqual(['a-1', 'a-2']);
  expect(window.location.search).toContain('project=a-2');
});

it('explains when the open project was reassigned before it was saved', async () => {
  mockJudgingApi([withProjects(['a-1', 'a-2']), withProjects(['a-2'])], {
    status: 404,
    body: { message: 'Project not found.' },
  });
  render(<EventJudgingPanel eventId="event" judgeToken="token" />);
  expect(await screen.findByText('Project a-1')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'demo: 5' }));
  fireEvent.click(screen.getByRole('button', { name: 'idea: 5' }));
  fireEvent.click(screen.getAllByRole('button', { name: /Save & next/ })[0]);
  expect(
    await screen.findByText(
      'Project a-1 was reassigned to another judge, so these scores were not saved.'
    )
  ).toBeInTheDocument();
  expect(screen.getByText('Project a-2')).toBeInTheDocument();
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
      .mockResolvedValueOnce({ ok: true, json: async () => panel })
      .mockResolvedValue({ ok: true, status: 204, json: async () => null });
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
