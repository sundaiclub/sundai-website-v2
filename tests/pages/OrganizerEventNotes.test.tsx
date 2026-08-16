import React from 'react';
import { resolvedParams } from '../utils/next';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';

const mockUseTheme = jest.fn();

jest.mock('../../src/app/contexts/ThemeContext', () => ({
  useTheme: () => mockUseTheme(),
}));

jest.mock('next/navigation', () => ({
  usePathname: () => '/organizer/events/event-ai-build-night/notes',
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    refresh: jest.fn(),
  }),
}));

const eventId = 'event-ai-build-night';
const hackerId = 'hacker-ada';

const noteRow = {
  hacker: {
    id: hackerId,
    name: 'Ada Builder',
    username: 'adabuilder',
    email: 'ada@example.com',
  },
  registrationStatus: 'APPROVED',
  projectTitles: ['Accessible AI'],
  note: {
    body: 'Prefers a quiet demo setup.',
    updatedAt: '2026-07-10T12:00:00.000Z',
    updatedBy: { id: 'hacker-mc', name: 'Morgan MC' },
  },
};

function jsonResponse(data: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(data),
    text: jest.fn().mockResolvedValue(JSON.stringify(data)),
  });
}

function requestUrl(input: RequestInfo | URL) {
  return typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.toString()
      : input.url;
}

function mockNotesFetch({
  rows = [noteRow],
  canViewRevisions = true,
}: {
  rows?: (typeof noteRow)[];
  canViewRevisions?: boolean;
} = {}) {
  global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(requestUrl(input), 'http://localhost');
    if (url.pathname === `/api/events/${eventId}/notes` && !init?.method) {
      const search = url.searchParams.get('search')?.toLowerCase();
      const filtered = search
        ? rows.filter(row => row.hacker.name.toLowerCase().includes(search))
        : rows;
      return jsonResponse({
        items: filtered,
        nextCursor: null,
        capabilities: { canViewRevisions },
      });
    }
    if (
      url.pathname === `/api/events/${eventId}/notes/${hackerId}` &&
      !init?.method
    ) {
      return jsonResponse(noteRow);
    }
    if (
      url.pathname === `/api/events/${eventId}/notes/${hackerId}` &&
      init?.method === 'PUT'
    ) {
      return jsonResponse({
        ...noteRow,
        note: {
          ...noteRow.note,
          body: JSON.parse(String(init.body)).body,
        },
      });
    }
    if (url.pathname === `/api/events/${eventId}/notes/${hackerId}/revisions`) {
      return jsonResponse({
        items: [
          {
            id: 'revision-1',
            body: 'Needs a quiet setup.',
            editedAt: '2026-07-09T12:00:00.000Z',
            editedBy: { id: 'hacker-admin', name: 'Chapter Admin' },
          },
        ],
      });
    }
    return jsonResponse({ error: `Unexpected request: ${url.pathname}` }, 500);
  }) as jest.Mock;
}

function loadPage(): React.ComponentType<{
  params: Promise<{ eventId: string }>;
}> {
  try {
    return require('../../src/app/organizer/events/[eventId]/notes/page')
      .default;
  } catch (error) {
    throw new Error(`Expected organizer notes page for T061: ${String(error)}`);
  }
}

function renderPage() {
  const Page = loadPage();
  return render(<Page params={resolvedParams({ eventId })} />);
}

describe('/organizer/events/[eventId]/notes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseTheme.mockReturnValue({ isDarkMode: false });
    mockNotesFetch();
  });

  afterEach(cleanup);

  it('searches event-relevant hackers through the event-scoped notes API', async () => {
    renderPage();
    expect(await screen.findByText('Ada Builder')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('searchbox', { name: /search/i }), {
      target: { value: 'Ada' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^search$/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringMatching(
          `/api/events/${eventId}/notes\\?search=Ada|/api/events/${eventId}/notes\\?.*search=Ada`
        )
      );
    });
    expect(screen.queryByText(/global ban|blocked/i)).not.toBeInTheDocument();
  });

  it('opens and updates the shared current organizer note in event scope', async () => {
    renderPage();
    fireEvent.click(
      await screen.findByRole('button', { name: /ada builder/i })
    );

    const editor = await screen.findByLabelText(/organizer note/i);
    expect(editor).toHaveValue('Prefers a quiet demo setup.');
    fireEvent.change(editor, {
      target: { value: 'Confirmed a quiet demo setup near the side wall.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save note/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        `/api/events/${eventId}/notes/${hackerId}`,
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({
            body: 'Confirmed a quiet demo setup near the side wall.',
          }),
        })
      );
    });
    expect(await screen.findByText(/note saved/i)).toBeInTheDocument();
  });

  it('warns that notes are internal and discourages sensitive protected-class data', async () => {
    renderPage();

    expect(
      await screen.findByText(/internal.*not.*public|organizer-only/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/sensitive.*protected-class|protected-class.*sensitive/i)
    ).toBeInTheDocument();
  });

  it('shows revision history only when the current role has history capability', async () => {
    renderPage();
    fireEvent.click(
      await screen.findByRole('button', { name: /ada builder/i })
    );
    fireEvent.click(
      await screen.findByRole('button', {
        name: /view.*history|revision history/i,
      })
    );
    expect(await screen.findByText('Chapter Admin')).toBeInTheDocument();
    expect(screen.getByText('Needs a quiet setup.')).toBeInTheDocument();

    cleanup();
    mockNotesFetch({ canViewRevisions: false });
    renderPage();
    fireEvent.click(
      await screen.findByRole('button', { name: /ada builder/i })
    );
    expect(
      screen.queryByRole('button', { name: /view.*history|revision history/i })
    ).not.toBeInTheDocument();
  });

  it('renders empty and load-error states without stale note content', async () => {
    mockNotesFetch({ rows: [] });
    renderPage();
    expect(
      await screen.findByText(/no relevant hackers|no notes/i)
    ).toBeInTheDocument();

    cleanup();
    global.fetch = jest.fn(() => jsonResponse({ error: 'Unavailable' }, 503));
    renderPage();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(
      /notes.*unavailable|unable to load.*notes/i
    );
    expect(
      screen.queryByText('Prefers a quiet demo setup.')
    ).not.toBeInTheDocument();
  });
});
