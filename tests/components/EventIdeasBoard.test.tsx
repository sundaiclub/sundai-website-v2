import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { EventIdeasBoard } from '@/app/components/EventIdeasBoard';
import type { PublicEventIdea } from '@/types/event-ideas';

jest.mock('@/app/contexts/ThemeContext', () => ({
  useTheme: () => ({ isDarkMode: false }),
}));

const existingIdea: PublicEventIdea = {
  id: 'idea-1',
  name: 'Grace',
  idea: 'Compiler for plants',
  description: 'Turns watering schedules into code',
  createdAt: '2026-11-10T15:30:00.000Z',
  canEdit: false,
  canDelete: false,
};

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  });
}

function renderBoard(
  viewerName: string | null = null,
  initialIdeas: PublicEventIdea[] = [existingIdea]
) {
  render(
    <EventIdeasBoard
      eventId="e1"
      initialIdeas={initialIdeas}
      timezone="America/New_York"
      viewerName={viewerName}
    />
  );
}

describe('EventIdeasBoard', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('shows submitted ideas in a table', () => {
    global.fetch = jest.fn() as jest.Mock;
    renderBoard();

    const row = screen.getByRole('row', { name: /grace/i });
    expect(row).toHaveTextContent('Compiler for plants');
    expect(row).toHaveTextContent('Turns watering schedules into code');
    expect(row).toHaveTextContent('10:30 AM');
  });

  it('prefills the signed-in viewer name', () => {
    global.fetch = jest.fn() as jest.Mock;
    renderBoard('Ada Lovelace');

    fireEvent.click(screen.getByRole('button', { name: 'Add idea' }));

    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue(
      'Ada Lovelace'
    );
  });

  it('requires a name and idea but not a description', async () => {
    const created: PublicEventIdea = {
      id: 'idea-2',
      name: 'Ada',
      idea: 'Plant-watering robot',
      description: null,
      createdAt: '2026-11-10T16:00:00.000Z',
      canEdit: false,
      canDelete: false,
    };
    global.fetch = jest.fn(() => jsonResponse(created, 201)) as jest.Mock;
    renderBoard();

    fireEvent.click(screen.getByRole('button', { name: 'Add idea' }));
    const dialog = screen.getByRole('dialog');
    const submit = within(dialog).getByRole('button', { name: 'Add idea' });
    expect(submit).toBeDisabled();

    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Name' }), {
      target: { value: 'Ada' },
    });
    expect(submit).toBeDisabled();
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Idea' }), {
      target: { value: 'Plant-watering robot' },
    });
    expect(submit).toBeEnabled();

    await act(async () => {
      fireEvent.click(submit);
    });

    expect(global.fetch).toHaveBeenCalledWith('/api/events/e1/ideas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Ada',
        idea: 'Plant-watering robot',
        description: '',
      }),
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows[0]).toHaveTextContent('Plant-watering robot');
    expect(rows[1]).toHaveTextContent('Compiler for plants');
  });

  it('shows the server error when an idea is rejected', async () => {
    global.fetch = jest.fn(() =>
      jsonResponse({ message: 'Idea is required' }, 400)
    ) as jest.Mock;
    renderBoard('Ada');

    fireEvent.click(screen.getByRole('button', { name: 'Add idea' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Idea' }), {
      target: { value: 'x' },
    });
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Add idea' }));
    });

    expect(within(dialog).getByText('Idea is required')).toBeInTheDocument();
  });

  it('hides row actions from viewers who cannot edit or delete', () => {
    global.fetch = jest.fn() as jest.Mock;
    renderBoard();

    expect(
      screen.queryByRole('button', { name: /^(edit|delete) /i })
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole('columnheader')).toHaveLength(4);
  });

  it('shows edit and delete on the author’s own idea only', () => {
    global.fetch = jest.fn() as jest.Mock;
    renderBoard('Grace', [
      { ...existingIdea, canEdit: true, canDelete: true },
      { ...existingIdea, id: 'idea-other', idea: 'Someone else’s idea' },
    ]);

    expect(
      screen.getByRole('button', { name: 'Edit Compiler for plants' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Delete Compiler for plants' })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /someone else’s idea/i })
    ).not.toBeInTheDocument();
  });

  it('lets authors edit their own idea', async () => {
    const ownIdea = { ...existingIdea, canEdit: true };
    const saved = { ...ownIdea, idea: 'Compiler for gardens' };
    global.fetch = jest.fn(() => jsonResponse(saved)) as jest.Mock;
    renderBoard('Grace', [ownIdea]);

    expect(
      screen.queryByRole('button', { name: /^delete /i })
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Edit Compiler for plants' })
    );
    const dialog = screen.getByRole('dialog', { name: 'Edit your idea' });
    expect(within(dialog).getByRole('textbox', { name: 'Name' })).toHaveValue(
      'Grace'
    );
    expect(
      within(dialog).getByRole('textbox', { name: /description/i })
    ).toHaveValue('Turns watering schedules into code');
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Idea' }), {
      target: { value: 'Compiler for gardens' },
    });

    await act(async () => {
      fireEvent.click(
        within(dialog).getByRole('button', { name: 'Save idea' })
      );
    });

    expect(global.fetch).toHaveBeenCalledWith('/api/events/e1/ideas/idea-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Grace',
        idea: 'Compiler for gardens',
        description: 'Turns watering schedules into code',
      }),
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(2);
    expect(screen.getByText('Compiler for gardens')).toBeInTheDocument();
  });

  it('lets organizers delete an idea after confirming', async () => {
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(true);
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: true, status: 204 })
    ) as jest.Mock;
    renderBoard(null, [{ ...existingIdea, canDelete: true }]);

    expect(
      screen.queryByRole('button', { name: /^edit /i })
    ).not.toBeInTheDocument();
    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', { name: 'Delete Compiler for plants' })
      );
    });

    expect(confirm).toHaveBeenCalled();
    expect(global.fetch).toHaveBeenCalledWith('/api/events/e1/ideas/idea-1', {
      method: 'DELETE',
    });
    expect(screen.queryByText('Compiler for plants')).not.toBeInTheDocument();
    confirm.mockRestore();
  });

  it('keeps the idea when the organizer cancels or the delete fails', async () => {
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(false);
    global.fetch = jest.fn(() =>
      jsonResponse({ message: 'You can only delete your own ideas' }, 403)
    ) as jest.Mock;
    renderBoard(null, [{ ...existingIdea, canDelete: true }]);
    const deleteButton = screen.getByRole('button', {
      name: 'Delete Compiler for plants',
    });

    fireEvent.click(deleteButton);
    expect(global.fetch).not.toHaveBeenCalled();

    confirm.mockReturnValue(true);
    await act(async () => {
      fireEvent.click(deleteButton);
    });

    expect(
      screen.getByText('You can only delete your own ideas')
    ).toBeInTheDocument();
    expect(screen.getByText('Compiler for plants')).toBeInTheDocument();
    confirm.mockRestore();
  });

  it('refreshes the ideas every 10 seconds', async () => {
    jest.useFakeTimers();
    const refreshed: PublicEventIdea = {
      id: 'idea-3',
      name: 'Linus',
      idea: 'Kernel for coffee makers',
      description: null,
      createdAt: '2026-11-10T16:10:00.000Z',
      canEdit: false,
      canDelete: false,
    };
    global.fetch = jest.fn(() =>
      jsonResponse({ ideas: [refreshed, existingIdea] })
    ) as jest.Mock;
    renderBoard();

    await act(async () => {
      jest.advanceTimersByTime(9_999);
    });
    expect(global.fetch).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(global.fetch).toHaveBeenCalledWith('/api/events/e1/ideas', {
      cache: 'no-store',
    });
    expect(screen.getByText('Kernel for coffee makers')).toBeInTheDocument();
  });
});
