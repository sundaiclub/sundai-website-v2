import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OrganizerNotePanel from '../../src/app/components/OrganizerNotePanel';
import { ThemeProvider } from '../../src/app/contexts/ThemeContext';

global.fetch = jest.fn();

const currentNote = {
  id: 'organizer-note-current',
  hackerId: 'hacker-ada',
  body: 'Ask about presentation accessibility needs before demo night.',
  updatedById: 'hacker-admin',
  updatedBy: { id: 'hacker-admin', name: 'Grace Hopper' },
  createdAt: '2026-05-25T12:00:00.000Z',
  updatedAt: '2026-05-25T12:30:00.000Z',
};

const revisions = [
  {
    id: 'organizer-note-revision',
    noteId: 'organizer-note-current',
    hackerId: 'hacker-ada',
    editedById: 'hacker-admin',
    editedBy: { id: 'hacker-admin', name: 'Grace Hopper' },
    patchText:
      '--- previous\n+++ current\n-Ask about presentation needs.\n+Ask about presentation accessibility needs before demo night.',
    createdAt: '2026-05-25T12:30:00.000Z',
  },
];

const defaultProps = {
  hackerId: 'hacker-ada',
  title: 'Organizer note for Ada Lovelace',
  eventId: 'event-boston-demo-night',
};

const noteUrl =
  '/api/hackers/hacker-ada/organizer-note?eventId=event-boston-demo-night';
const revisionsUrl =
  '/api/hackers/hacker-ada/organizer-note/revisions?eventId=event-boston-demo-night';

const editableAccess = {
  canViewCurrentNote: true,
  canEditCurrentNote: true,
  canViewRevisions: true,
};

function mockJsonResponse(body: unknown, ok = true) {
  return Promise.resolve({
    ok,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as Response);
}

function renderOrganizerNotePanel() {
  return render(
    <ThemeProvider>
      <OrganizerNotePanel {...defaultProps} />
    </ThemeProvider>
  );
}

describe('OrganizerNotePanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockReset();
  });

  it('loads the current organizer note into an editable text area', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      await mockJsonResponse({ note: currentNote, access: editableAccess })
    );

    renderOrganizerNotePanel();

    expect(
      screen.getByText('Organizer note for Ada Lovelace')
    ).toBeInTheDocument();

    const noteEditor = await screen.findByLabelText(/organizer note/i);
    await waitFor(() => {
      expect(noteEditor).toHaveValue(currentNote.body);
    });
    expect(noteEditor).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /save note/i })).toBeEnabled();
    expect(
      screen.getByRole('button', { name: /view revisions/i })
    ).toBeEnabled();
    expect(global.fetch).toHaveBeenCalledWith(noteUrl);
  });

  it('saves edits with the current note endpoint and confirms the save', async () => {
    const user = userEvent.setup();
    const nextBody = 'Prefers to pitch second after the hardware team.';

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(
        await mockJsonResponse({ note: currentNote, access: editableAccess })
      )
      .mockResolvedValueOnce(
        await mockJsonResponse({
          note: {
            ...currentNote,
            body: nextBody,
            updatedAt: '2026-05-25T13:00:00.000Z',
          },
          access: editableAccess,
        })
      );

    renderOrganizerNotePanel();

    const noteEditor = await screen.findByLabelText(/organizer note/i);
    await waitFor(() => {
      expect(noteEditor).not.toBeDisabled();
    });
    await user.clear(noteEditor);
    await user.type(noteEditor, nextBody);
    await user.click(screen.getByRole('button', { name: /save note/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenLastCalledWith(noteUrl, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ body: nextBody }),
      });
    });

    expect(
      await screen.findByText(/organizer note saved/i)
    ).toBeInTheDocument();
  });

  it('renders a read-only surface when the actor cannot edit the note', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      await mockJsonResponse({
        note: currentNote,
        access: {
          canViewCurrentNote: true,
          canEditCurrentNote: false,
          canViewRevisions: false,
        },
      })
    );

    renderOrganizerNotePanel();

    const noteEditor = await screen.findByLabelText(/organizer note/i);
    await waitFor(() => {
      expect(noteEditor).toHaveValue(currentNote.body);
    });
    expect(noteEditor).toBeDisabled();
    expect(screen.getByRole('button', { name: /save note/i })).toBeDisabled();
    expect(
      screen.queryByRole('button', { name: /view revisions/i })
    ).not.toBeInTheDocument();
  });

  it('loads and displays revision history only when revision access is allowed', async () => {
    const user = userEvent.setup();

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(
        await mockJsonResponse({ note: currentNote, access: editableAccess })
      )
      .mockResolvedValueOnce(
        await mockJsonResponse({ revisions, access: editableAccess })
      );

    renderOrganizerNotePanel();

    await user.click(
      await screen.findByRole('button', { name: /view revisions/i })
    );

    expect(await screen.findByText('Revision history')).toBeInTheDocument();
    expect(
      screen.getAllByText(/presentation accessibility needs before demo night/i)
        .length
    ).toBeGreaterThan(0);
    expect(global.fetch).toHaveBeenNthCalledWith(2, revisionsUrl);
  });

  it('does not request revision history for MC-level current-note access', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      await mockJsonResponse({
        note: currentNote,
        access: {
          canViewCurrentNote: true,
          canEditCurrentNote: true,
          canViewRevisions: false,
        },
      })
    );

    renderOrganizerNotePanel();

    await screen.findByLabelText(/organizer note/i);

    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).not.toHaveBeenCalledWith(revisionsUrl);
    expect(screen.queryByText('Revision history')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /view revisions/i })
    ).not.toBeInTheDocument();
  });
});
