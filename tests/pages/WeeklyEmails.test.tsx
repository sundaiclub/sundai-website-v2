import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import WeeklyEmailsPage from '@/app/admin/weekly-emails/page';
import { ThemeProvider } from '@/app/contexts/ThemeContext';

jest.mock('@/app/contexts/UserContext', () => ({
  useUserContext: () => ({
    isAdmin: true,
    userInfo: { id: 'admin' },
    loading: false,
  }),
}));
jest.mock('next/navigation', () => ({
  useRouter: () => ({ back: jest.fn() }),
}));
jest.mock('react-markdown', () => ({
  __esModule: true,
  default: ({ children }: { children: string }) => <div>{children}</div>,
}));
const fetchMock = jest.fn();
const response = (body: unknown) => ({ ok: true, json: async () => body });

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock;
});

it('loads saved drafts, previews Markdown, and saves the current content before a self test', async () => {
  fetchMock
    .mockResolvedValueOnce(
      response({
        drafts: [{ id: 'draft', subject: 'Original', body: 'Saved message' }],
      })
    )
    .mockResolvedValueOnce(
      response({ id: 'draft', subject: 'Edited', body: 'Saved message' })
    )
    .mockResolvedValueOnce(response({ sent: 1, failed: 0, test: true }));
  render(
    <ThemeProvider>
      <WeeklyEmailsPage />
    </ThemeProvider>
  );
  await screen.findByRole('option', { name: 'Original' });
  fireEvent.change(screen.getByRole('combobox', { name: 'Saved drafts' }), {
    target: { value: 'draft' },
  });
  expect(
    screen.getByRole('textbox', { name: 'Weekly email message' })
  ).toHaveValue('Saved message');
  fireEvent.change(screen.getByRole('textbox', { name: 'Subject' }), {
    target: { value: 'Edited' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'preview' }));
  expect(screen.getByText('Saved message')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Send test to myself' }));
  await screen.findByText('Test email sent to your account email address.');
  expect(fetchMock.mock.calls[1]).toEqual([
    '/api/admin/weekly-emails/draft',
    expect.objectContaining({
      method: 'PATCH',
      body: JSON.stringify({ subject: 'Edited', body: 'Saved message' }),
    }),
  ]);
  expect(fetchMock.mock.calls[2]).toEqual([
    '/api/admin/weekly-emails/draft',
    expect.objectContaining({ body: JSON.stringify({ action: 'test' }) }),
  ]);
  expect(screen.getByRole('textbox', { name: 'Subject' })).toHaveValue(
    'Edited'
  );
});

it('clears the editor after a send and shows provider failures without a delivery history', async () => {
  fetchMock
    .mockResolvedValueOnce(response({ drafts: [] }))
    .mockResolvedValueOnce(
      response({ id: 'new', subject: 'News', body: 'Hello' })
    )
    .mockResolvedValueOnce(response({ sent: 3, failed: 1 }));
  render(
    <ThemeProvider>
      <WeeklyEmailsPage />
    </ThemeProvider>
  );
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeEnabled()
  );
  fireEvent.change(screen.getByRole('textbox', { name: 'Subject' }), {
    target: { value: 'News' },
  });
  fireEvent.change(
    screen.getByRole('textbox', { name: 'Weekly email message' }),
    { target: { value: 'Hello' } }
  );
  fireEvent.click(screen.getByRole('button', { name: 'Send', exact: true }));
  await screen.findByText(
    'Send complete. 3 emails accepted by the email service. 1 emails could not be sent.'
  );
  expect(screen.getByRole('textbox', { name: 'Subject' })).toHaveValue('');
});
