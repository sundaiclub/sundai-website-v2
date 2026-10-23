import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AddProjectDialog } from '@/app/components/AddProjectDialog';
import { ThemeProvider } from '@/app/contexts/ThemeContext';
import toast from 'react-hot-toast';

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: { error: jest.fn() },
}));

describe('AddProjectDialog', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          projects: [
            {
              id: 'project-added',
              title: 'Already pitching',
              preview: 'Existing queue item',
              startDate: '2026-08-20T00:00:00.000Z',
              eventAdded: true,
              pitchAdded: true,
            },
            {
              id: 'project-event-only',
              title: 'Event only',
              preview: 'Can still join the queue',
              startDate: '2026-08-21T00:00:00.000Z',
              eventAdded: true,
              pitchAdded: false,
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'pitch-1' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          projects: [
            {
              id: 'project-added',
              title: 'Already pitching',
              startDate: '2026-08-20T00:00:00.000Z',
              eventAdded: true,
              pitchAdded: true,
            },
            {
              id: 'project-event-only',
              title: 'Event only',
              startDate: '2026-08-21T00:00:00.000Z',
              eventAdded: true,
              pitchAdded: true,
            },
          ],
        }),
      });
  });

  it('shows a pop-up and keeps the chooser open when a GitHub link is required', async () => {
    const message =
      'GitHub link is required. Enter a URL that contains github.com.';
    (global.fetch as jest.Mock)
      .mockReset()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          projects: [{ id: 'p1', title: 'Missing link', pitchAdded: false }],
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ message }),
      });
    const onProjectAdded = jest.fn();
    render(
      <ThemeProvider>
        <AddProjectDialog
          eventId="event-1"
          eventTitle="Build Night"
          open
          onClose={jest.fn()}
          onProjectAdded={onProjectAdded}
        />
      </ThemeProvider>
    );
    fireEvent.click(await screen.findByRole('radio', { name: 'Missing link' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add project' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(toast.error).toHaveBeenCalledWith(message);
    expect(onProjectAdded).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('shows new project first, marks queue entries, and stays open after adding', async () => {
    render(
      <ThemeProvider>
        <AddProjectDialog
          eventId="event-1"
          eventTitle="Boston Build Night"
          onClose={jest.fn()}
          open
        />
      </ThemeProvider>
    );

    expect(screen.getByRole('link', { name: 'New project' })).toHaveAttribute(
      'href',
      expect.stringContaining('sourceEventId=event-1')
    );
    expect(screen.getByRole('dialog').firstElementChild).toHaveClass(
      '!bg-gray-900'
    );
    expect(await screen.findByText('Already added')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: /event only/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Add project' }));

    expect(
      await screen.findByText(
        'Successfully added to the event and pitch queue.'
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(3));
  });

  it('requires an explicit confirmation for another active queue', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          projects: [
            {
              id: 'project-1',
              title: 'Shared project',
              startDate: '2026-08-20T00:00:00.000Z',
              eventAdded: false,
              pitchAdded: false,
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({
          code: 'ACTIVE_EVENT_CONFLICT',
          events: [{ id: 'event-2', title: 'Cambridge Build Night' }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 'pitch-project-1' }),
      });

    render(
      <ThemeProvider>
        <AddProjectDialog
          eventId="event-1"
          eventTitle="Boston Build Night"
          onClose={jest.fn()}
          open
          redirectTo="/events/boston/build-night?tab=pitch"
        />
      </ThemeProvider>
    );

    fireEvent.click(
      await screen.findByRole('radio', { name: /shared project/i })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add project' }));

    expect(await screen.findByRole('alertdialog')).toHaveTextContent(
      'Cambridge Build Night'
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add anyway' }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(3));
    expect(
      JSON.parse((global.fetch as jest.Mock).mock.calls[2][1].body)
    ).toEqual({ projectId: 'project-1', confirmCrossEvent: true });
  });
});
