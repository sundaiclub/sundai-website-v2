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

const applicationTemplates = [
  {
    id: 'template-site',
    name: 'Sundai site requirements',
    scope: 'SITE',
    chapterId: null,
    isActive: true,
    fieldsJson: [
      {
        id: 'full-name',
        label: 'Full name',
        type: 'TEXT',
        required: true,
        siteRequired: true,
      },
      {
        id: 'email',
        label: 'Email',
        type: 'EMAIL',
        required: true,
        siteRequired: true,
      },
    ],
  },
  {
    id: 'template-chapter-boston',
    name: 'Boston builder application',
    scope: 'CHAPTER',
    chapterId: 'chapter-boston',
    isActive: true,
    fieldsJson: [
      {
        id: 'project-url',
        label: 'Project URL',
        type: 'URL',
        required: false,
      },
      {
        id: 'dietary-restrictions',
        label: 'Dietary restrictions',
        type: 'TEXT',
        required: false,
      },
    ],
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

    if (url.includes('/api/application-templates')) {
      return jsonResponse(applicationTemplates);
    }

    if (url.includes('/api/events/event-created/publish')) {
      return jsonResponse({
        id: 'event-created',
        status: 'PUBLISHED',
      });
    }

    if (url.includes('/api/events/event-created/image')) {
      return jsonResponse({
        id: 'event-image',
        url: 'https://cdn.example.com/event.webp',
        alt: 'Boston AI Build Night event',
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
  changeControl(/public description/i, 'A public build night for AI projects.');
  changeControl(/public location/i, 'Kendall Square, Cambridge');
  changeControl(/event day/i, '2026-07-10');
}

function nextSundayInputValue(from = new Date()) {
  const daysUntilSunday = (7 - from.getDay()) % 7 || 7;
  const nextSunday = new Date(from);
  nextSunday.setDate(from.getDate() + daysUntilSunday);
  const year = nextSunday.getFullYear();
  const month = String(nextSunday.getMonth() + 1).padStart(2, '0');
  const day = String(nextSunday.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function selectStaff(buttonName: RegExp, hackerName: RegExp) {
  fireEvent.click(screen.getByRole('button', { name: buttonName }));
  fireEvent.change(screen.getByPlaceholderText(/search members/i), {
    target: { value: '' },
  });
  fireEvent.click(await screen.findByText(hackerName));
}

function addCustomQuestion(label: string, type = 'TEXT', required = false) {
  changeControl(/custom question label/i, label);
  changeControl(/custom question type/i, type);
  if (required) {
    fireEvent.click(screen.getByLabelText(/required custom question/i));
  }
  fireEvent.click(screen.getByRole('button', { name: /add custom question/i }));
}

describe('/organizer/events/new', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseTheme.mockReturnValue({ isDarkMode: false });
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: jest.fn(() => 'blob:event-preview'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: jest.fn(),
    });
    window.history.replaceState({}, '', '/organizer/events/new');
    mockOrganizerFetches();
  });

  it('renders required event fields and defaults timezone from the selected chapter', async () => {
    await renderNewEventPage();

    expect(screen.getByLabelText(/^chapter$/i)).toHaveValue('chapter-boston');
    expect(screen.getByLabelText(/^title$/i)).toBeRequired();
    expect(screen.queryByLabelText(/slug/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/public description/i)).toBeRequired();
    expect(screen.getByLabelText(/public location/i)).toBeRequired();
    expect(screen.getByLabelText(/event day/i)).toBeRequired();
    expect(screen.getByLabelText(/event day/i)).toHaveValue(
      nextSundayInputValue()
    );
    expect(screen.getByLabelText(/event image/i)).toHaveAttribute(
      'accept',
      'image/jpeg,image/png,image/webp,image/gif'
    );
    expect(screen.getByText(/10:00 AM to 10:00 PM/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/timezone/i)).toHaveValue('America/New_York');
    expect(screen.getByLabelText(/^capacity$/i)).toBeRequired();
    expect(screen.getByLabelText(/^capacity$/i)).toHaveValue(100);
    expect(screen.getByLabelText(/no capacity limit/i)).not.toBeChecked();

    fireEvent.change(screen.getByLabelText(/^chapter$/i), {
      target: { value: 'chapter-san-francisco' },
    });

    await waitFor(() => {
      expect(screen.getByLabelText(/timezone/i)).toHaveValue(
        'America/Los_Angeles'
      );
    });
  });

  it('uploads a selected event image after creating the event', async () => {
    await renderNewEventPage();
    fillRequiredEventFields();
    const image = new File(['event-image'], 'demo-night.webp', {
      type: 'image/webp',
    });

    fireEvent.change(screen.getByLabelText(/event image/i), {
      target: { files: [image] },
    });
    fireEvent.click(screen.getByRole('button', { name: /save draft/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/events/event-created/image',
        expect.objectContaining({
          method: 'POST',
          body: expect.any(FormData),
        })
      );
    });
    const imageCall = (global.fetch as jest.Mock).mock.calls.find(([url]) =>
      requestUrl(url).includes('/api/events/event-created/image')
    );
    expect((imageCall?.[1].body as FormData).get('image')).toBe(image);
    expect(
      screen.getByText(/event draft was successfully created/i)
    ).toBeInTheDocument();
  });

  it('preselects the requested chapter from the chapterId query parameter', async () => {
    window.history.replaceState(
      {},
      '',
      '/organizer/events/new?chapterId=chapter-san-francisco'
    );

    await renderNewEventPage();

    expect(screen.getByLabelText(/^chapter$/i)).toHaveValue(
      'chapter-san-francisco'
    );
    expect(screen.getByLabelText(/timezone/i)).toHaveValue(
      'America/Los_Angeles'
    );
  });

  it('shows approved-only detail, staff assignment, application question, and message controls', async () => {
    await renderNewEventPage();

    expect(screen.getByLabelText(/approved-only address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/approved-only details/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/program type/i)).not.toBeInTheDocument();
    expect(
      screen.getByLabelText(/chapter application template/i)
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/application mode/i)).toHaveValue(
      'REQUIRES_APPROVAL'
    );
    expect(screen.getByLabelText(/auto-promote waitlist/i)).not.toBeChecked();

    expect(screen.getByLabelText(/^mcs?$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/co[-\s]?mcs?/i)).toBeInTheDocument();
    expect(await screen.findByText(/full name/i)).toBeInTheDocument();
    expect(screen.getAllByText(/email/i).length).toBeGreaterThan(0);
    expect(screen.getByLabelText(/custom question label/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/custom question type/i)).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /checkbox/i })).toHaveValue(
      'CHECKBOX'
    );
    expect(
      screen.getByRole('button', { name: /add custom question/i })
    ).toBeDisabled();

    expect(screen.getByLabelText(/confirmation message/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/waitlist message/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/decline message/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirmation message/i)).toHaveValue(
      'Your registration is confirmed. We look forward to seeing you at the event.'
    );
    expect(screen.getByLabelText(/waitlist message/i)).toHaveValue(
      'You are on the waitlist. We will let you know if a spot opens up.'
    );
    expect(screen.getByLabelText(/decline message/i)).toHaveValue(
      'Thank you for your interest. Unfortunately, we are unable to offer you a spot at this event.'
    );
  });

  it('submits the site message defaults when the organizer leaves them unchanged', async () => {
    await renderNewEventPage();

    fillRequiredEventFields();
    fireEvent.click(screen.getByRole('button', { name: /save draft/i }));

    await waitFor(() => {
      expect(latestFetchBody()).toEqual(
        expect.objectContaining({
          confirmationMessage:
            'Your registration is confirmed. We look forward to seeing you at the event.',
          waitlistMessage:
            'You are on the waitlist. We will let you know if a spot opens up.',
          declineMessage:
            'Thank you for your interest. Unfortunately, we are unable to offer you a spot at this event.',
        })
      );
    });

    expect(
      screen.getByText(/event draft was successfully created/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /event settings page/i })
    ).toHaveAttribute('href', '/organizer/events/event-created/settings');
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

  it('greys out and disables capacity when no capacity limit is selected', async () => {
    await renderNewEventPage();

    const capacityInput = screen.getByLabelText(/^capacity$/i);

    expect(capacityInput).toBeEnabled();
    expect(capacityInput).toBeRequired();

    fireEvent.click(screen.getByLabelText(/no capacity limit/i));

    expect(capacityInput).toBeDisabled();
    expect(capacityInput).not.toBeRequired();
    expect(capacityInput).toHaveClass('disabled:bg-gray-100');
    expect(capacityInput).toHaveClass('disabled:cursor-not-allowed');
    expect(capacityInput).toHaveClass('disabled:opacity-70');
  });

  it('opens the change time dialog and submits the selected time window', async () => {
    await renderNewEventPage();

    fillRequiredEventFields();
    fireEvent.click(screen.getByRole('button', { name: /change time/i }));
    expect(screen.getByRole('dialog')).toHaveClass('!bg-white');
    changeControl(/start time of day/i, '18:00');
    changeControl(/end time of day/i, '21:00');
    fireEvent.click(screen.getByRole('button', { name: /done/i }));

    fireEvent.click(screen.getByRole('button', { name: /save draft/i }));

    await waitFor(() => {
      expect(latestFetchBody()).toEqual(
        expect.objectContaining({
          startTime: '2026-07-10T18:00',
          endTime: '2026-07-10T21:00',
        })
      );
    });
  });

  it('submits no capacity limit as an unlimited event', async () => {
    await renderNewEventPage();

    fillRequiredEventFields();
    fireEvent.click(screen.getByLabelText(/no capacity limit/i));
    fireEvent.click(screen.getByRole('button', { name: /save draft/i }));

    await waitFor(() => {
      expect(latestFetchBody()).toEqual(
        expect.objectContaining({
          capacity: null,
        })
      );
    });
  });

  it('submits full creation fields and publishes through the visible publish action', async () => {
    await renderNewEventPage();

    fillRequiredEventFields();
    changeControl(/approved-only address/i, '42 Private Lane');
    changeControl(
      /approved-only details/i,
      'Use the side door and bring a laptop.'
    );
    changeControl(/chapter application template/i, 'template-chapter-boston');
    await selectStaff(/^mcs?$/i, /morgan mc/i);
    await selectStaff(/co[-\s]?mcs?/i, /casey co-mc/i);
    addCustomQuestion('What do you want to build?', 'TEXTAREA', true);
    addCustomQuestion('Anything else we should know?');
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

    expect(
      screen.getByText(/event was successfully published/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /event settings page/i })
    ).toHaveAttribute('href', '/organizer/events/event-created/settings');

    expect(latestFetchBody()).toEqual(
      expect.objectContaining({
        chapterId: 'chapter-boston',
        title: 'Boston AI Build Night',
        slug: 'boston-ai-build-night',
        description: 'A public build night for AI projects.',
        publicLocation: 'Kendall Square, Cambridge',
        startTime: '2026-07-10T10:00',
        endTime: '2026-07-10T22:00',
        timezone: 'America/New_York',
        capacity: 100,
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
            label: 'Project URL',
            type: 'URL',
          }),
          expect.objectContaining({
            label: 'Dietary restrictions',
            type: 'TEXT',
          }),
          expect.objectContaining({
            label: 'What do you want to build?',
            type: 'TEXTAREA',
            required: true,
          }),
          expect.objectContaining({
            label: 'Anything else we should know?',
            type: 'TEXT',
          }),
        ]),
        hideChapterDefaultQuestions: true,
        confirmationMessage: 'Thanks for applying.',
        waitlistMessage: 'You are on the waitlist.',
        declineMessage: 'We cannot accommodate your application.',
      })
    );
  });

  it('reorders selected application questions after site-required questions', async () => {
    await renderNewEventPage();

    fillRequiredEventFields();
    changeControl(/chapter application template/i, 'template-chapter-boston');
    addCustomQuestion('What do you want to build?');

    const customQuestion = screen.getByLabelText(
      /drag application question what do you want to build/i
    );
    const projectQuestion = screen.getByLabelText(
      /drag application question project url/i
    );

    fireEvent.dragStart(customQuestion);
    fireEvent.dragOver(projectQuestion);
    fireEvent.drop(projectQuestion);
    fireEvent.click(screen.getByRole('button', { name: /save draft/i }));

    await waitFor(() => {
      const labels = latestFetchBody().applicationQuestionsJson.map(
        (field: { label: string }) => field.label
      );

      expect(labels).toEqual([
        'What do you want to build?',
        'Project URL',
        'Dietary restrictions',
      ]);
    });
  });

  it('shows custom question required state and removes custom questions', async () => {
    await renderNewEventPage();

    fillRequiredEventFields();
    addCustomQuestion('What do you want to build?', 'TEXTAREA', true);
    addCustomQuestion('Anything else we should know?');

    expect(screen.getByText('Required')).toBeInTheDocument();
    expect(screen.getByText('Optional')).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', {
        name: /remove custom question anything else we should know/i,
      })
    );
    fireEvent.click(screen.getByRole('button', { name: /save draft/i }));

    await waitFor(() => {
      const labels = latestFetchBody().applicationQuestionsJson.map(
        (field: { label: string }) => field.label
      );

      expect(labels).toEqual(['What do you want to build?']);
    });
  });

  it('submits checkbox custom questions as checkbox fields', async () => {
    await renderNewEventPage();

    fillRequiredEventFields();
    addCustomQuestion('I agree to the event guidelines', 'CHECKBOX', true);

    expect(
      screen.getByLabelText(
        /drag application question i agree to the event guidelines/i
      )
    ).toHaveTextContent('Checkbox');
    expect(screen.queryByText('BOOLEAN')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /save draft/i }));

    await waitFor(() => {
      expect(latestFetchBody().applicationQuestionsJson).toEqual([
        expect.objectContaining({
          label: 'I agree to the event guidelines',
          type: 'CHECKBOX',
          required: true,
        }),
      ]);
    });
  });

  it('lets custom questions opt into reusing a previous answer', async () => {
    await renderNewEventPage();

    fillRequiredEventFields();
    changeControl(/custom question label/i, 'What do you want to build?');
    fireEvent.click(
      screen.getByLabelText(/reuse previous answer for custom question/i)
    );
    fireEvent.click(
      screen.getByRole('button', { name: /add custom question/i })
    );
    fireEvent.click(screen.getByRole('button', { name: /save draft/i }));

    await waitFor(() => {
      expect(latestFetchBody().applicationQuestionsJson).toEqual([
        expect.objectContaining({
          label: 'What do you want to build?',
          reusePreviousAnswer: true,
        }),
      ]);
    });
  });
});
