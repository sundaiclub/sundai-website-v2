import React from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import StaffInvitationPage from '../../src/app/events/staff-invitations/[invitationId]/page';
import StaffInvitations from '../../src/app/organizer/events/[eventId]/staff/StaffInvitations';

const mockUseUser = jest.fn();
const mockReplace = jest.fn();
const mockOpenSignIn = jest.fn();
const mockRouter = { replace: mockReplace };
jest.mock('@clerk/nextjs', () => ({
  useUser: () => mockUseUser(),
  useClerk: () => ({ openSignIn: mockOpenSignIn }),
}));
jest.mock('next/navigation', () => ({ useRouter: () => mockRouter }));
jest.mock('../../src/app/contexts/ThemeContext', () => ({
  useTheme: () => ({ isDarkMode: false }),
}));

function response(payload: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  window.history.replaceState({}, '', '/events/staff-invitations/invite-1');
  mockUseUser.mockReturnValue({ isLoaded: true, isSignedIn: false });
  global.fetch = jest.fn();
});
afterEach(() => {
  cleanup();
  window.history.replaceState({}, '', '/');
});

it('prompts visitors to create an account and keeps the invite as the return page', () => {
  render(<StaffInvitationPage params={{ invitationId: 'invite-1' }} />);
  fireEvent.click(
    screen.getByRole('button', { name: 'Sign in or create an account' })
  );
  expect(mockOpenSignIn).toHaveBeenCalledWith({
    forceRedirectUrl: '/events/staff-invitations/invite-1',
    signUpForceRedirectUrl: '/events/staff-invitations/invite-1',
  });
  expect(global.fetch).not.toHaveBeenCalled();
});

it('accepts after sign-in and opens the event workspace', async () => {
  mockUseUser.mockReturnValue({ isLoaded: true, isSignedIn: true });
  (global.fetch as jest.Mock).mockImplementation(() =>
    response({ workspaceUrl: '/organizer/events/event-1' })
  );
  render(<StaffInvitationPage params={{ invitationId: 'invite-1' }} />);
  await waitFor(() =>
    expect(mockReplace).toHaveBeenCalledWith('/organizer/events/event-1')
  );
  expect(global.fetch).toHaveBeenCalledWith(
    '/api/events/staff-invitations/invite-1/accept',
    { method: 'POST' }
  );
});

it('shows the email verification error and permits a retry', async () => {
  mockUseUser.mockReturnValue({ isLoaded: true, isSignedIn: true });
  (global.fetch as jest.Mock).mockImplementation(() =>
    response({ message: 'Verify the invited email address.' }, 403)
  );
  render(<StaffInvitationPage params={{ invitationId: 'invite-1' }} />);
  expect(
    await screen.findByText('Verify the invited email address.')
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
  expect(mockReplace).not.toHaveBeenCalled();
});

it('sends an email invite, displays its link, and lets the sender cancel it', async () => {
  (global.fetch as jest.Mock).mockImplementation(
    (_url: string, init?: RequestInit) => {
      if (init?.method === 'POST')
        return response(
          {
            invitation: {
              id: 'invite-1',
              email: 'new@example.com',
              expiresAt: '2026-10-30T12:00:00Z',
            },
            delivery: {
              sent: true,
              link: 'https://example.com/events/staff-invitations/invite-1',
            },
          },
          201
        );
      if (init?.method === 'DELETE') return response(null, 204);
      return response([]);
    }
  );
  render(<StaffInvitations eventId="event-1" />);
  await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(1));
  fireEvent.change(
    screen.getByRole('textbox', { name: 'Co-MC email address' }),
    { target: { value: 'new@example.com' } }
  );
  fireEvent.click(screen.getByRole('button', { name: 'Send co-MC invite' }));
  expect(await screen.findByText('Co-MC invite sent.')).toBeInTheDocument();
  expect(screen.getByRole('link')).toHaveAttribute(
    'href',
    'https://example.com/events/staff-invitations/invite-1'
  );
  expect(global.fetch).toHaveBeenCalledWith(
    '/api/events/event-1/staff/invitations',
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ email: 'new@example.com' }),
    })
  );
  fireEvent.click(screen.getByRole('button', { name: 'Cancel invite' }));
  expect(
    await screen.findByText('Co-MC invite cancelled.')
  ).toBeInTheDocument();
  expect(screen.queryByText('new@example.com')).not.toBeInTheDocument();
});
