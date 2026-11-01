import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import EventJudgingPanel from '@/app/components/EventJudgingPanel';
import type { JudgePanelPayload } from '@/types/judging';
import { useSearchParams } from 'next/navigation';

jest.mock('next/navigation', () => ({
  useSearchParams: () => {
    const React = require('react');
    const search = React.useSyncExternalStore(
      (onChange: () => void) => {
        window.addEventListener('popstate', onChange);
        window.addEventListener('test:replace-state', onChange);
        return () => {
          window.removeEventListener('popstate', onChange);
          window.removeEventListener('test:replace-state', onChange);
        };
      },
      () => window.location.search
    );
    return React.useMemo(() => new URLSearchParams(search), [search]);
  },
}));

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

const multipleTracks: JudgePanelPayload = {
  ...panel,
  tracks: [
    {
      ...panel.tracks[0],
      projects: [
        panel.tracks[0].projects[0],
        {
          ...panel.tracks[0].projects[0],
          submissionId: 's2',
          projectId: 'p2',
          title: 'Second project',
          review: null,
        },
      ],
    },
    {
      ...panel.tracks[0],
      id: 'b',
      name: 'B',
      projects: [
        {
          ...panel.tracks[0].projects[0],
          trackId: 'b',
          submissionId: 's3',
          projectId: 'p3',
          title: 'Other track project',
        },
        {
          ...panel.tracks[0].projects[0],
          trackId: 'b',
          submissionId: 's4',
          projectId: 'p4',
          title: 'Other track second project',
        },
      ],
    },
    { ...panel.tracks[0], id: 'empty', name: 'Empty', projects: [] },
  ],
};

const replaceState = window.history.replaceState.bind(window.history);
const routerState = {
  __NA: true,
  __PRIVATE_NEXTJS_INTERNALS_TREE: ['event'],
};

beforeEach(() => {
  replaceState(
    { ...routerState, preserved: true },
    '',
    '/events/boston/hackathon?tab=judging&judge=token#scores'
  );
  // Model the App Router's history wrapper: internal Next.js calls bypass
  // synchronization; external calls notify useSearchParams and retain its state.
  jest
    .spyOn(window.history, 'replaceState')
    .mockImplementation((data, title, url) => {
      if (data?.__NA || data?._N) {
        replaceState(data, title, url);
        return;
      }
      replaceState({ ...data, ...routerState }, title, url);
      window.dispatchEvent(new Event('test:replace-state'));
    });
  window.scrollTo = jest.fn();
});

afterEach(() => {
  jest.restoreAllMocks();
});

function RouterProject() {
  const params = useSearchParams();
  return <output aria-label="Router project">{params.get('project')}</output>;
}

it('keeps Next.js search parameters synchronized when using project buttons', async () => {
  global.fetch = jest
    .fn()
    .mockResolvedValue({ ok: true, json: async () => multipleTracks });
  render(
    <>
      <EventJudgingPanel eventId="event" judgeToken="token" />
      <RouterProject />
    </>
  );
  expect(await screen.findByText('Assigned project')).toBeInTheDocument();
  fireEvent.click(
    (await screen.findAllByRole('button', { name: /Next project/ }))[0]
  );
  await waitFor(() =>
    expect(screen.getByLabelText('Router project')).toHaveTextContent('2')
  );
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

it('waits for publication and then loads the assigned list', async () => {
  window.history.replaceState({}, '', '?tab=judging&track=b&project=2');
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
      .mockResolvedValueOnce({ ok: true, json: async () => multipleTracks });
    render(<EventJudgingPanel eventId="event" judgeToken={null} />);
    await act(async () => {});
    expect(screen.getByText(/Judging has not started/)).toBeInTheDocument();
    expect(screen.queryByText('Assigned project')).not.toBeInTheDocument();
    expect(new URLSearchParams(window.location.search).get('project')).toBe(
      '2'
    );
    await act(async () => {
      jest.advanceTimersByTime(15000);
    });
    expect(screen.getByText('Other track second project')).toBeInTheDocument();
  } finally {
    jest.useRealTimers();
  }
});

it('updates the project number on navigation and restores it after refresh', async () => {
  global.fetch = jest
    .fn()
    .mockResolvedValue({ ok: true, json: async () => multipleTracks });
  const view = render(<EventJudgingPanel eventId="event" judgeToken="token" />);
  expect(await screen.findByText('Assigned project')).toBeInTheDocument();
  expect(new URLSearchParams(window.location.search).get('project')).toBe('1');

  fireEvent.click(screen.getAllByRole('button', { name: /Next project/ })[0]);
  expect(await screen.findByText('Second project')).toBeInTheDocument();
  expect(new URLSearchParams(window.location.search).get('project')).toBe('2');
  expect(new URLSearchParams(window.location.search).get('tab')).toBe(
    'judging'
  );
  expect(new URLSearchParams(window.location.search).get('judge')).toBe(
    'token'
  );
  expect(window.location.hash).toBe('#scores');
  expect(window.history.state).toEqual({ ...routerState, preserved: true });

  view.unmount();
  render(<EventJudgingPanel eventId="event" judgeToken="token" />);
  expect(await screen.findByText('Second project')).toBeInTheDocument();
  expect(screen.getAllByText('Project 2 of 2')).toHaveLength(2);

  fireEvent.click(
    screen.getAllByRole('button', { name: /Previous project/ })[0]
  );
  expect(await screen.findByText('Assigned project')).toBeInTheDocument();
  expect(new URLSearchParams(window.location.search).get('project')).toBe('1');
});

it('follows same-page URL navigation without refetching or remounting', async () => {
  global.fetch = jest
    .fn()
    .mockResolvedValue({ ok: true, json: async () => multipleTracks });
  render(<EventJudgingPanel eventId="event" judgeToken="token" />);
  expect(await screen.findByText('Assigned project')).toBeInTheDocument();

  act(() => {
    window.history.replaceState(
      null,
      '',
      '?tab=judging&track=b&project=2&judge=token'
    );
  });
  expect(
    await screen.findByText('Other track second project')
  ).toBeInTheDocument();
  expect(screen.getByText('You are now judging B')).toBeInTheDocument();
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

it('restores the displayed project when browser history changes', async () => {
  global.fetch = jest
    .fn()
    .mockResolvedValue({ ok: true, json: async () => multipleTracks });
  render(<EventJudgingPanel eventId="event" judgeToken="token" />);
  expect(await screen.findByText('Assigned project')).toBeInTheDocument();

  act(() => {
    replaceState(routerState, '', '?tab=judging&track=b&project=2&judge=token');
    window.dispatchEvent(new PopStateEvent('popstate', { state: routerState }));
  });
  expect(
    await screen.findByText('Other track second project')
  ).toBeInTheDocument();

  act(() => {
    replaceState(routerState, '', '?tab=judging&track=a&project=1&judge=token');
    window.dispatchEvent(new PopStateEvent('popstate', { state: routerState }));
  });
  expect(await screen.findByText('Assigned project')).toBeInTheDocument();
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

it('does not normalize a new event URL with the previous event assignments', async () => {
  global.fetch = jest
    .fn()
    .mockResolvedValueOnce({ ok: true, json: async () => multipleTracks })
    .mockReturnValueOnce(new Promise(() => {}));
  const view = render(<EventJudgingPanel eventId="event" judgeToken="token" />);
  expect(await screen.findByText('Assigned project')).toBeInTheDocument();

  replaceState(
    routerState,
    '',
    '/events/boston/other?tab=judging&track=other&project=4'
  );
  view.rerender(<EventJudgingPanel eventId="other" judgeToken="token" />);
  expect(screen.getByText('Loading judging…')).toBeInTheDocument();
  expect(new URLSearchParams(window.location.search).get('track')).toBe(
    'other'
  );
  expect(new URLSearchParams(window.location.search).get('project')).toBe('4');
});

it('restores the selected track and resets the project when changing tracks', async () => {
  window.history.replaceState(
    {},
    '',
    '?tab=judging&track=b&project=2&judge=token'
  );
  global.fetch = jest
    .fn()
    .mockResolvedValue({ ok: true, json: async () => multipleTracks });
  render(<EventJudgingPanel eventId="event" judgeToken="token" />);
  expect(
    await screen.findByText('Other track second project')
  ).toBeInTheDocument();
  expect(screen.getByText('You are now judging B')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /Judge A/ }));
  expect(await screen.findByText('Assigned project')).toBeInTheDocument();
  expect(new URLSearchParams(window.location.search).get('track')).toBe('a');
  expect(new URLSearchParams(window.location.search).get('project')).toBe('1');
});

it.each(['0', '-1', '3', '1.5', '2abc', '9007199254740992', ''])(
  'falls back to project 1 for invalid project=%s',
  async value => {
    window.history.replaceState(
      {},
      '',
      `?tab=judging&track=a&project=${value}`
    );
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: true, json: async () => multipleTracks });
    render(<EventJudgingPanel eventId="event" judgeToken={null} />);
    expect(await screen.findByText('Assigned project')).toBeInTheDocument();
    expect(new URLSearchParams(window.location.search).get('project')).toBe(
      '1'
    );
  }
);

it('falls back to an assigned track when the URL track is unavailable', async () => {
  window.history.replaceState({}, '', '?tab=judging&track=removed&project=2');
  global.fetch = jest
    .fn()
    .mockResolvedValue({ ok: true, json: async () => multipleTracks });
  render(<EventJudgingPanel eventId="event" judgeToken={null} />);
  expect(await screen.findByText('Second project')).toBeInTheDocument();
  expect(new URLSearchParams(window.location.search).get('track')).toBe('a');
});

it('restores an empty track without writing a nonexistent project', async () => {
  window.history.replaceState({}, '', '?tab=judging&track=empty&project=2');
  global.fetch = jest
    .fn()
    .mockResolvedValue({ ok: true, json: async () => multipleTracks });
  render(<EventJudgingPanel eventId="event" judgeToken={null} />);
  expect(
    await screen.findByText('You have no assigned projects in Empty.')
  ).toBeInTheDocument();
  expect(new URLSearchParams(window.location.search).has('project')).toBe(
    false
  );
});

it('keeps the project and URL unchanged when saving before navigation fails', async () => {
  global.fetch = jest
    .fn()
    .mockResolvedValueOnce({ ok: true, json: async () => multipleTracks })
    .mockResolvedValue({
      ok: false,
      json: async () => ({ message: 'Save failed' }),
    });
  render(<EventJudgingPanel eventId="event" judgeToken="token" />);
  expect(await screen.findByText('Assigned project')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'demo: 5' }));
  const originalUrl = window.location.href;

  fireEvent.click(screen.getAllByRole('button', { name: /Save & next/ })[0]);
  expect(await screen.findByText('Save failed')).toBeInTheDocument();
  expect(screen.getByText('Assigned project')).toBeInTheDocument();
  expect(window.location.href).toBe(originalUrl);

  fireEvent.click(screen.getByRole('button', { name: /Judge B/ }));
  await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(3));
  expect(screen.getByText('Assigned project')).toBeInTheDocument();
  expect(window.location.href).toBe(originalUrl);
});

it('updates the URL only after pending scores save successfully', async () => {
  let finishSave!: (value: unknown) => void;
  global.fetch = jest
    .fn()
    .mockResolvedValueOnce({ ok: true, json: async () => multipleTracks })
    .mockReturnValueOnce(
      new Promise(resolve => {
        finishSave = resolve;
      })
    );
  render(<EventJudgingPanel eventId="event" judgeToken="token" />);
  expect(await screen.findByText('Assigned project')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'demo: 5' }));
  fireEvent.click(screen.getAllByRole('button', { name: /Save & next/ })[0]);
  expect(new URLSearchParams(window.location.search).get('project')).toBe('1');
  expect(screen.getByText('Assigned project')).toBeInTheDocument();

  await act(async () => {
    finishSave({
      ok: true,
      json: async () => ({ scores: { idea: 4, demo: 5 }, comment: '' }),
    });
  });
  expect(await screen.findByText('Second project')).toBeInTheDocument();
  expect(new URLSearchParams(window.location.search).get('project')).toBe('2');
  expect(global.fetch).toHaveBeenLastCalledWith(
    '/api/judging/event/reviews/s1',
    expect.objectContaining({
      method: 'PUT',
      body: JSON.stringify({ scores: { idea: 4, demo: 5 }, comment: '' }),
    })
  );
});
