import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import OrganizerEventJudgingPage from '@/app/organizer/events/[eventId]/judging/page';

const mockWorkspace = jest.fn();
jest.mock('next/navigation', () => ({
  useParams: () => ({ eventId: 'event-1' }),
}));
jest.mock('@/app/organizer/events/[eventId]/WorkspaceShell', () => ({
  useEventWorkspace: () => mockWorkspace(),
}));
jest.mock('@/app/contexts/ThemeContext', () => ({
  useTheme: () => ({ theme: 'light' }),
}));
jest.mock(
  '@/app/organizer/events/[eventId]/judging/JudgingSetupEditor',
  () =>
    function Setup() {
      return <p>Setup content</p>;
    }
);
jest.mock(
  '@/app/organizer/events/[eventId]/judging/JudgingResultsView',
  () =>
    function Results() {
      return <p>Results content</p>;
    }
);
jest.mock(
  '@/app/organizer/events/[eventId]/judging/JudgingAssignmentsView',
  () =>
    function Assignments() {
      return <p>Assignments content</p>;
    }
);
jest.mock(
  '@/app/organizer/events/[eventId]/judging/JudgesManager',
  () =>
    function Judges() {
      return <p>Judges content</p>;
    }
);

const originalCreate = URL.createObjectURL;
const originalRevoke = URL.revokeObjectURL;
beforeEach(() => {
  jest.clearAllMocks();
  mockWorkspace.mockReturnValue({ capabilities: { manageJudging: true } });
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ judgingEnabled: false, judgingOpen: false }),
  });
  URL.createObjectURL = jest.fn().mockReturnValue('blob:judging');
  URL.revokeObjectURL = jest.fn();
});
afterEach(() => {
  jest.restoreAllMocks();
  URL.createObjectURL = originalCreate;
  URL.revokeObjectURL = originalRevoke;
});

it('keeps the download available on every judging tab even when judging is off', async () => {
  render(<OrganizerEventJudgingPage />);
  expect(
    await screen.findByRole('button', { name: 'Download judging results' })
  ).toBeEnabled();
  for (const tab of ['Judges', 'Assignments', 'Results', 'Setup']) {
    fireEvent.click(screen.getByRole('tab', { name: tab }));
    expect(
      screen.getByRole('button', { name: 'Download judging results' })
    ).toBeEnabled();
  }
});

it('hides the download from people without judging management access', () => {
  mockWorkspace.mockReturnValue({ capabilities: { manageJudging: false } });
  render(<OrganizerEventJudgingPage />);
  expect(
    screen.queryByRole('button', { name: /download judging/i })
  ).not.toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent('Only MCs and admins');
});

it('downloads the Excel attachment and clears the temporary link', async () => {
  const click = jest
    .spyOn(HTMLAnchorElement.prototype, 'click')
    .mockImplementation(() => {});
  const blob = new Blob(['workbook']);
  render(<OrganizerEventJudgingPage />);
  const button = await screen.findByRole('button', {
    name: 'Download judging results',
  });
  (global.fetch as jest.Mock).mockResolvedValueOnce({
    ok: true,
    blob: async () => blob,
    headers: new Headers({
      'Content-Disposition':
        'attachment; filename="demo-day-judging-results.xlsx"',
    }),
  });
  fireEvent.click(button);
  expect(
    screen.getByRole('button', { name: 'Downloading judging results…' })
  ).toBeDisabled();
  await waitFor(() => expect(click).toHaveBeenCalledTimes(1));
  expect((click.mock.instances[0] as HTMLAnchorElement).download).toBe(
    'demo-day-judging-results.xlsx'
  );
  expect(global.fetch).toHaveBeenLastCalledWith(
    '/api/events/event-1/judging/export',
    { cache: 'no-store' }
  );
  expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:judging');
  expect(document.querySelector('a[download]')).toBeNull();
  expect(button).toBeEnabled();
});

it('shows a failed download and allows retry', async () => {
  render(<OrganizerEventJudgingPage />);
  const button = await screen.findByRole('button', {
    name: 'Download judging results',
  });
  (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false });
  fireEvent.click(button);
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Could not download judging results. Please try again.'
  );
  expect(button).toBeEnabled();
  expect(URL.createObjectURL).not.toHaveBeenCalled();
});
