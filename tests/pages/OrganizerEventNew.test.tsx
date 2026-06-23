import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import OrganizerNewEventPage from '../../src/app/organizer/events/new/page';

const mockUseTheme = jest.fn();

jest.mock('../../src/app/contexts/ThemeContext', () => ({
  useTheme: () => mockUseTheme(),
}));

jest.mock('next/navigation', () => ({
  usePathname: () => '/organizer/events/new',
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
  }),
}));

const chapters = [
  {
    id: 'chapter-boston',
    name: 'Sundai Boston',
    slug: 'boston',
    timezone: 'America/New_York',
  },
  {
    id: 'chapter-san-francisco',
    name: 'Sundai San Francisco',
    slug: 'san-francisco',
    timezone: 'America/Los_Angeles',
  },
];

const staffCandidates = [
  {
    id: 'hacker-mc',
    name: 'Morgan MC',
    email: 'morgan@example.com',
  },
  {
    id: 'hacker-comc',
    name: 'Casey Co-MC',
    email: 'casey@example.com',
  },
];

function jsonResponse(data: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: jest.fn().mockResolvedValue(data),
    text: jest
      .fn()
      .mockResolvedValue(
        typeof data === 'string' ? data : JSON.stringify(data)
      ),
  });
}

function requestUrl(input: RequestInfo | URL) {
  if (typeof input === 'string') return input;
  if ('url' in input) return input.url;
  return input.toString();
}

function latestFetchBody() {
  const postCall = (global.fetch as jest.Mock).mock.calls.find(
    ([url, init]) =>
      requestUrl(url).includes('/api/events') && init?.method === 'POST'
  );

  if (!postCall) {
    throw new Error('Expected a POST /api/events fetch call');
  }

  return JSON.parse(String(postCall[1].body));
}

function mockOrganizerFetches() {
  global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = requestUrl(input);

    if (url.includes('/api/chapters')) {
      return jsonResponse(chapters);
    }

    if (url.includes('/api/hackers') || url.includes('/members')) {
      return jsonResponse(staffCandidates);
    }

    if (url.includes('/api/events/event-created/publish')) {
      return jsonResponse({
        id: 'event-created',
        status: 'PUBLISHED',
      });
    }

    if (url.endsWith('/api/events') && init?.method === 'POST') {
      return jsonResponse(
        {
          id: 'event-created',
          status: 'DRAFT',
        },
        201
      );
    }

    return jsonResponse({});
  }) as jest.Mock;
}

async function renderNewEventPage() {
  render(<OrganizerNewEventPage />);

  await screen.findByRole('heading', { name: /new event/i });
}

function changeControl(label: RegExp, value: string) {
  fireEvent.change(screen.getByLabelText(label), {
    target: { value },
  });
}

function fillRequiredEventFields() {
  changeControl(/^title$/i, 'Boston AI Build Night');
  changeControl(/slug/i, 'boston-ai-build-night');
  changeControl(/public description/i, 'A public build night for AI projects.');
  changeControl(/public location/i, 'Kendall Square, Cambridge');
  changeControl(/start time/i, '2026-07-10T18:00');
  changeControl(/end time/i, '2026-07-10T21:00');
  changeControl(/capacity/i, '40');
}

describe('/organizer/events/new', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseTheme.mockReturnValue({ isDarkMode: false });
    mockOrganizerFetches();
  });

  it('renders required event fields and defaults timezone from the selected chapter', async () => {
    await renderNewEventPage();

    expect(screen.getByLabelText(/chapter/i)).toHaveValue('chapter-boston');
    expect(screen.getByLabelText(/^title$/i)).toBeRequired();
    expect(screen.getByLabelText(/slug/i)).toBeRequired();
    expect(screen.getByLabelText(/public description/i)).toBeRequired();
    expect(screen.getByLabelText(/public location/i)).toBeRequired();
    expect(screen.getByLabelText(/start time/i)).toBeRequired();
    expect(screen.getByLabelText(/end time/i)).toBeRequired();
    expect(screen.getByLabelText(/timezone/i)).toHaveValue('America/New_York');
    expect(screen.getByLabelText(/capacity/i)).toBeRequired();

    fireEvent.change(screen.getByLabelText(/chapter/i), {
      target: { value: 'chapter-san-francisco' },
    });

    await waitFor(() => {
      expect(screen.getByLabelText(/timezone/i)).toHaveValue(
        'America/Los_Angeles'
      );
    });
  });

  it('shows approved-only detail, staff assignment, application question, and message controls', async () => {
    await renderNewEventPage();

    expect(screen.getByLabelText(/approved-only address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/approved-only details/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/program|template/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/application mode/i)).toHaveValue(
      'REQUIRES_APPROVAL'
    );
    expect(screen.getByLabelText(/auto-promote waitlist/i)).not.toBeChecked();

    expect(screen.getByLabelText(/^mcs?$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/co[-\s]?mcs?/i)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /add application question/i })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/question label/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/question type/i)).toBeInTheDocument();

    expect(screen.getByLabelText(/confirmation message/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/waitlist message/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/decline message/i)).toBeInTheDocument();
  });

  it('keeps publish visible but disabled until required fields are present', async () => {
    await renderNewEventPage();

    expect(screen.getByRole('button', { name: /save draft/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /publish/i })).toBeDisabled();

    fillRequiredEventFields();

    expect(
      screen.getByRole('button', { name: /save draft/i })
    ).not.toBeDisabled();
    expect(screen.getByRole('button', { name: /publish/i })).not.toBeDisabled();
  });

  it('submits full creation fields and publishes through the visible publish action', async () => {
    await renderNewEventPage();

    fillRequiredEventFields();
    changeControl(/approved-only address/i, '42 Private Lane');
    changeControl(
      /approved-only details/i,
      'Use the side door and bring a laptop.'
    );
    changeControl(/program|template/i, 'builder-sprint');
    changeControl(/^mcs?$/i, 'hacker-mc');
    changeControl(/co[-\s]?mcs?/i, 'hacker-comc');
    changeControl(/question label/i, 'What do you want to build?');
    changeControl(/question type/i, 'TEXTAREA');
    fireEvent.click(screen.getByLabelText(/required question/i));
    changeControl(/confirmation message/i, 'Thanks for applying.');
    changeControl(/waitlist message/i, 'You are on the waitlist.');
    changeControl(
      /decline message/i,
      'We cannot accommodate your application.'
    );

    fireEvent.click(screen.getByRole('button', { name: /publish/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/events',
        expect.objectContaining({
          method: 'POST',
        })
      );
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/events/event-created/publish',
        expect.objectContaining({
          method: 'POST',
        })
      );
    });

    expect(latestFetchBody()).toEqual(
      expect.objectContaining({
        chapterId: 'chapter-boston',
        title: 'Boston AI Build Night',
        slug: 'boston-ai-build-night',
        description: 'A public build night for AI projects.',
        publicLocation: 'Kendall Square, Cambridge',
        startTime: '2026-07-10T18:00',
        endTime: '2026-07-10T21:00',
        timezone: 'America/New_York',
        capacity: 40,
        applicationMode: 'REQUIRES_APPROVAL',
        autoPromoteWaitlist: false,
        approvedDetailsJson: expect.objectContaining({
          address: '42 Private Lane',
          details: 'Use the side door and bring a laptop.',
        }),
        staff: expect.arrayContaining([
          expect.objectContaining({ hackerId: 'hacker-mc', role: 'MC' }),
          expect.objectContaining({ hackerId: 'hacker-comc', role: 'CO_MC' }),
        ]),
        applicationQuestionsJson: expect.arrayContaining([
          expect.objectContaining({
            label: 'What do you want to build?',
            type: 'TEXTAREA',
            required: true,
          }),
        ]),
        confirmationMessage: 'Thanks for applying.',
        waitlistMessage: 'You are on the waitlist.',
        declineMessage: 'We cannot accommodate your application.',
      })
    );
  });
});
