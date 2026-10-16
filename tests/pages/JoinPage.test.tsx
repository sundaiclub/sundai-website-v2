import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mockUseTheme = jest.fn();
const mockUseUserContext = jest.fn();
const mockOpenSignIn = jest.fn();

jest.mock('../../src/app/contexts/ThemeContext', () => ({
  useTheme: () => mockUseTheme(),
}));

jest.mock('../../src/app/contexts/UserContext', () => ({
  useUserContext: () => mockUseUserContext(),
}));

jest.mock('@clerk/nextjs', () => ({
  useClerk: () => ({ openSignIn: mockOpenSignIn }),
}));

jest.mock('../../src/lib/smsConsent', () => ({
  SMS_CONSENT_CONFIGURED: true,
  SMS_CONSENT_COPY: 'I agree to receive Sundai text messages.',
  SMS_CONSENT_VERSION: 'v1',
}));

import JoinPage from '../../src/app/join/page';

const bostonChapter = {
  id: 'chapter-boston',
  name: 'Boston',
  slug: 'boston',
  city: 'Boston',
  region: 'MA',
  country: 'US',
  timezone: 'America/New_York',
  description: 'Boston builders',
  heroImage: null,
  accessMode: 'PUBLIC',
  status: 'ACTIVE',
};

const privateChapter = {
  ...bostonChapter,
  id: 'chapter-private',
  name: 'Secret',
  slug: 'secret',
  accessMode: 'PRIVATE',
};

const user = {
  id: 'hacker-1',
  name: 'Ada',
  email: 'ada@example.com',
  role: 'HACKER',
  phoneNumber: null,
};

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as Response);
}

describe('JoinPage', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseTheme.mockReturnValue({ isDarkMode: false });
    global.fetch = fetchMock as unknown as typeof fetch;
    window.history.replaceState(null, '', '/join');
  });

  it('lists chapters and opens Clerk sign-in when a signed-out visitor joins', async () => {
    mockUseUserContext.mockReturnValue({ userInfo: null, loading: false });
    fetchMock.mockImplementation(() =>
      jsonResponse([bostonChapter, privateChapter])
    );

    render(<JoinPage />);

    expect(
      screen.getByRole('heading', { name: 'Join a chapter' })
    ).toBeInTheDocument();
    expect(await screen.findByText('Boston')).toBeInTheDocument();
    expect(screen.getByText('Invite only')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Join' }));

    expect(mockOpenSignIn).toHaveBeenCalledWith({
      forceRedirectUrl: '/join?chapter=chapter-boston',
      signUpForceRedirectUrl: '/join?chapter=chapter-boston',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('joins the chapter and offers text messages after confirming email', async () => {
    mockUseUserContext.mockReturnValue({ userInfo: user, loading: false });
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      if (url === '/api/chapters') return jsonResponse([bostonChapter]);
      if (url === '/api/chapters/chapter-boston/join') {
        return jsonResponse(
          {
            role: 'MEMBER',
            status: 'ACTIVE',
            emailNotificationsEnabled: true,
          },
          201
        );
      }
      if (url === '/api/hackers/hacker-1') return jsonResponse(user);
      if (url === '/api/chapters/chapter-boston/notifications') {
        return jsonResponse({ status: 'ACTIVE', ...JSON.parse(String(init?.body)) });
      }
      throw new Error(`Unexpected fetch ${url}`);
    });

    render(<JoinPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Join' }));

    expect(
      await screen.findByRole('dialog', { name: 'You joined Boston' })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/subscribed to email updates about Boston/)
    ).toBeInTheDocument();
    expect(screen.getByText('Joined')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Mobile number'), {
      target: { value: '(555) 123-4567' },
    });
    fireEvent.click(
      screen.getByLabelText('I agree to receive Sundai text messages.')
    );
    fireEvent.click(screen.getByRole('button', { name: 'Turn on texts' }));

    expect(await screen.findByText(/Text messages are on/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/hackers/hacker-1', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phoneNumber: '+15551234567' }),
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/chapters/chapter-boston/notifications',
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          notificationsAllowed: true,
          emailNotificationsEnabled: true,
          smsNotificationsEnabled: true,
          smsConsentGranted: true,
        }),
      }
    );
  });

  it('shows the saved phone number instead of asking for it again', async () => {
    mockUseUserContext.mockReturnValue({
      userInfo: { ...user, phoneNumber: '+15559876543' },
      loading: false,
    });
    fetchMock.mockImplementation((url: string) => {
      if (url === '/api/chapters') return jsonResponse([bostonChapter]);
      return jsonResponse({ role: 'MEMBER', status: 'ACTIVE' }, 201);
    });

    render(<JoinPage />);

    fireEvent.click(await screen.findByRole('button', { name: 'Join' }));

    expect(await screen.findByText('+15559876543')).toBeInTheDocument();
    expect(screen.queryByLabelText('Mobile number')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Change' }));

    expect(screen.getByLabelText('Mobile number')).toHaveValue('+15559876543');
  });

  it('resumes the pending join after the visitor signs in', async () => {
    window.history.replaceState(null, '', '/join?chapter=chapter-boston');
    mockUseUserContext.mockReturnValue({ userInfo: user, loading: false });
    fetchMock.mockImplementation((url: string) => {
      if (url === '/api/chapters') return jsonResponse([bostonChapter]);
      return jsonResponse({ role: 'MEMBER', status: 'ACTIVE' }, 201);
    });

    render(<JoinPage />);

    expect(
      await screen.findByRole('dialog', { name: 'You joined Boston' })
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/chapters/chapter-boston/join',
      { method: 'POST' }
    );
    await waitFor(() => expect(window.location.search).toBe(''));
  });
});
