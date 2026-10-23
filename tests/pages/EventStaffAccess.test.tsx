import React from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  act,
} from '@testing-library/react';
import EventStaffAccessPage from '../../src/app/events/staff/[eventId]/page';
import AddCoMcByEmail from '../../src/app/organizer/events/[eventId]/staff/AddCoMcByEmail';

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
  window.history.replaceState({}, '', '/events/staff/event-1');
  mockUseUser.mockReturnValue({ isLoaded: true, isSignedIn: false });
  global.fetch = jest.fn();
});
afterEach(() => {
  cleanup();
  jest.useRealTimers();
  window.history.replaceState({}, '', '/');
});

it('returns new accounts to the event access page after signup', () => {
  render(<EventStaffAccessPage params={{ eventId: 'event-1' }} />);
  fireEvent.click(
    screen.getByRole('button', { name: 'Sign in or create an account' })
  );
  expect(mockOpenSignIn).toHaveBeenCalledWith({
    forceRedirectUrl: '/events/staff/event-1',
    signUpForceRedirectUrl: '/events/staff/event-1',
  });
  expect(global.fetch).not.toHaveBeenCalled();
});

it('opens the workspace after sign-in using the existing permission check', async () => {
  mockUseUser.mockReturnValue({ isLoaded: true, isSignedIn: true });
  (global.fetch as jest.Mock).mockImplementation(() => response({}));
  render(<EventStaffAccessPage params={{ eventId: 'event-1' }} />);
  await waitFor(() =>
    expect(mockReplace).toHaveBeenCalledWith('/organizer/events/event-1')
  );
  expect(global.fetch).toHaveBeenCalledWith('/api/events/event-1/workspace');
});

it('does not grant access to a different account or restore a removed assignment', async () => {
  mockUseUser.mockReturnValue({ isLoaded: true, isSignedIn: true });
  (global.fetch as jest.Mock).mockImplementation(() => response(null, 403));
  render(<EventStaffAccessPage params={{ eventId: 'event-1' }} />);
  expect(
    await screen.findByText(/this account does not have access/i)
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  await waitFor(() => expect(global.fetch).toHaveBeenCalledTimes(2));
  expect(mockReplace).not.toHaveBeenCalled();
});

it('waits for the signup webhook to link the account before opening the workspace', async () => {
  jest.useFakeTimers();
  mockUseUser.mockReturnValue({ isLoaded: true, isSignedIn: true });
  (global.fetch as jest.Mock)
    .mockResolvedValueOnce({ ok: false, status: 401 })
    .mockResolvedValueOnce({ ok: true, status: 200 });
  render(<EventStaffAccessPage params={{ eventId: 'event-1' }} />);
  await act(async () => {
    await Promise.resolve();
  });
  expect(
    screen.getByText(/your account is being prepared/i)
  ).toBeInTheDocument();
  await act(async () => {
    jest.advanceTimersByTime(2000);
  });
  expect(mockReplace).toHaveBeenCalledWith('/organizer/events/event-1');
});

it('adds the co-MC through the staff endpoint and updates the staff list', async () => {
  const onAssigned = jest.fn();
  const staff = {
    id: 'staff-new',
    hackerId: 'hacker-new',
    role: 'CO_MC',
    hacker: { id: 'hacker-new', name: 'New Person', email: 'new@example.com' },
  };
  (global.fetch as jest.Mock).mockImplementation(() =>
    response(
      {
        staff,
        delivery: {
          sent: true,
          link: 'https://example.com/events/staff/event-1',
        },
      },
      201
    )
  );
  render(<AddCoMcByEmail eventId="event-1" onAssigned={onAssigned} />);
  expect(global.fetch).not.toHaveBeenCalled();
  fireEvent.change(
    screen.getByRole('textbox', { name: 'Co-MC email address' }),
    { target: { value: 'new@example.com' } }
  );
  fireEvent.click(
    screen.getByRole('button', { name: 'Add co-MC and send email' })
  );
  expect(
    await screen.findByText('Co-MC added. Email sent.')
  ).toBeInTheDocument();
  expect(screen.getByRole('link')).toHaveAttribute(
    'href',
    'https://example.com/events/staff/event-1'
  );
  expect(global.fetch).toHaveBeenCalledWith(
    '/api/events/event-1/staff',
    expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ email: 'new@example.com', role: 'CO_MC' }),
    })
  );
  expect(onAssigned).toHaveBeenCalledWith({ ...staff, name: 'New Person' });
});
