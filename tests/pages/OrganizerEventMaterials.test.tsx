import React from 'react';
import { resolvedParams } from '../utils/next';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import type { EventMaterial } from '../../src/types/event-workspace';

const mockUseTheme = jest.fn();

jest.mock('../../src/app/contexts/ThemeContext', () => ({
  useTheme: () => mockUseTheme(),
}));

jest.mock('next/navigation', () => ({
  usePathname: () => '/organizer/events/event-ai-build-night/materials',
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    refresh: jest.fn(),
  }),
}));

const eventId = 'event-ai-build-night';

const publicLink: EventMaterial = {
  id: 'material-public-link',
  eventId,
  kind: 'LINK',
  visibility: 'PUBLIC',
  title: 'Public schedule',
  description: 'The event run of show.',
  externalUrl: 'https://example.com/schedule',
  originalFilename: null,
  mimeType: null,
  size: null,
  position: 10,
  isAvailable: true,
  availableFrom: null,
  availableUntil: null,
  createdById: 'hacker-mc',
  createdAt: '2026-07-10T12:00:00.000Z',
  updatedAt: '2026-07-10T12:00:00.000Z',
};

const approvedFile: EventMaterial = {
  ...publicLink,
  id: 'material-approved-file',
  kind: 'FILE',
  visibility: 'APPROVED_ATTENDEES',
  title: 'Attendee brief',
  description: null,
  externalUrl: null,
  originalFilename: 'attendee-brief.pdf',
  mimeType: 'application/pdf',
  size: 481230,
  position: 20,
};

const organizerFile: EventMaterial = {
  ...approvedFile,
  id: 'material-organizer-file',
  visibility: 'ORGANIZERS_ONLY',
  title: 'Sponsor contacts',
  originalFilename: 'sponsor-contacts.xlsx',
  mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  position: 30,
  isAvailable: false,
};

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
  return typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.toString()
      : input.url;
}

function mockMaterialsFetch(
  materials: EventMaterial[] = [publicLink, approvedFile, organizerFile]
) {
  global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = requestUrl(input);

    if (url === `/api/events/${eventId}/materials` && !init?.method) {
      return jsonResponse(materials);
    }
    if (
      url === `/api/events/${eventId}/materials/upload-intents` &&
      init?.method === 'POST'
    ) {
      return jsonResponse({
        uploadToken: 'opaque-upload-token',
        uploadUrl: 'https://storage.example.test/signed-put',
        expiresAt: '2026-07-10T13:00:00.000Z',
      });
    }
    if (url === 'https://storage.example.test/signed-put') {
      return jsonResponse(null, 200);
    }
    if (url === `/api/events/${eventId}/materials` && init?.method === 'POST') {
      const body = JSON.parse(String(init.body));
      return jsonResponse(
        body.kind === 'LINK'
          ? { ...publicLink, ...body, id: 'material-new-link' }
          : {
              ...approvedFile,
              ...body,
              id: 'material-new-file',
              originalFilename: 'sponsor-brief.pdf',
            },
        201
      );
    }
    if (init?.method === 'PATCH') {
      return jsonResponse({
        ...approvedFile,
        ...JSON.parse(String(init.body)),
      });
    }
    if (init?.method === 'DELETE') {
      return jsonResponse(null, 204);
    }

    return jsonResponse({ error: 'Unexpected request' }, 500);
  }) as jest.Mock;
}

function loadPage(): React.ComponentType<{
  params: Promise<{ eventId: string }>;
}> {
  try {
    return require('../../src/app/organizer/events/[eventId]/materials/page')
      .default;
  } catch (error) {
    throw new Error(
      `Expected organizer materials page for T034: ${String(error)}`
    );
  }
}

async function renderPage() {
  const Page = loadPage();
  return render(
    await (
      Page as unknown as (props: {
        params: Promise<{ eventId: string }>;
      }) => Promise<React.ReactElement>
    )({
      params: resolvedParams({ eventId }),
    })
  );
}

function fetchBody(path: string, method: string) {
  const call = (global.fetch as jest.Mock).mock.calls.find(
    ([input, init]) => requestUrl(input) === path && init?.method === method
  );
  if (!call) throw new Error(`Expected ${method} ${path}`);
  return JSON.parse(String(call[1].body));
}

describe('/organizer/events/[eventId]/materials', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseTheme.mockReturnValue({ isDarkMode: false });
    mockMaterialsFetch();
  });

  afterEach(cleanup);

  it('shows the upload policy before file selection and labels visibility and availability', async () => {
    await renderPage();

    expect(await screen.findByText('Public schedule')).toBeInTheDocument();
    const policy = screen.getByRole('heading', {
      name: /file upload policy/i,
    }).parentElement!;
    expect(within(policy).getByText(/25 MiB/i)).toBeInTheDocument();
    expect(within(policy).getByText(/PDF/i)).toBeInTheDocument();
    expect(
      within(policy).getByText(/PNG|JPEG|WebP|image/i)
    ).toBeInTheDocument();
    expect(screen.getByText('Public')).toBeInTheDocument();
    expect(screen.getByText(/approved attendees/i)).toBeInTheDocument();
    expect(screen.getByText(/organizers only/i)).toBeInTheDocument();
    expect(
      screen.getByText('Unavailable', { selector: 'span' })
    ).toBeInTheDocument();
  });

  it('creates an https link with organizer-selected visibility and ordering', async () => {
    await renderPage();
    await screen.findByText('Public schedule');

    fireEvent.click(screen.getByRole('button', { name: /add material/i }));
    fireEvent.click(screen.getByRole('radio', { name: /link/i }));
    fireEvent.change(screen.getByLabelText(/title/i), {
      target: { value: 'Brainstorming board' },
    });
    fireEvent.change(screen.getByLabelText(/https.*url|link url/i), {
      target: { value: 'https://example.com/board' },
    });
    fireEvent.change(screen.getByLabelText(/visibility/i), {
      target: { value: 'APPROVED_ATTENDEES' },
    });
    fireEvent.change(screen.getByLabelText(/position|order/i), {
      target: { value: '25' },
    });
    fireEvent.click(screen.getByRole('button', { name: /create material/i }));

    await waitFor(() => {
      expect(
        fetchBody(`/api/events/${eventId}/materials`, 'POST')
      ).toMatchObject({
        kind: 'LINK',
        title: 'Brainstorming board',
        externalUrl: 'https://example.com/board',
        visibility: 'APPROVED_ATTENDEES',
        position: 25,
      });
    });
  });

  it('uploads a file through an intent before finalizing the material record', async () => {
    await renderPage();
    await screen.findByText('Public schedule');

    fireEvent.click(screen.getByRole('button', { name: /add material/i }));
    fireEvent.click(screen.getByRole('radio', { name: /file/i }));
    fireEvent.change(screen.getByLabelText(/title/i), {
      target: { value: 'Sponsor brief' },
    });
    fireEvent.change(screen.getByLabelText(/visibility/i), {
      target: { value: 'ORGANIZERS_ONLY' },
    });
    const file = new File(['brief'], 'sponsor-brief.pdf', {
      type: 'application/pdf',
    });
    fireEvent.change(screen.getByLabelText(/choose file|file upload/i), {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByRole('button', { name: /upload.*create/i }));

    await waitFor(() => {
      expect(
        fetchBody(`/api/events/${eventId}/materials/upload-intents`, 'POST')
      ).toMatchObject({
        filename: 'sponsor-brief.pdf',
        mimeType: 'application/pdf',
        size: file.size,
      });
      expect(global.fetch).toHaveBeenCalledWith(
        'https://storage.example.test/signed-put',
        expect.objectContaining({ method: 'PUT', body: file })
      );
      expect(
        fetchBody(`/api/events/${eventId}/materials`, 'POST')
      ).toMatchObject({
        kind: 'FILE',
        title: 'Sponsor brief',
        uploadToken: 'opaque-upload-token',
        visibility: 'ORGANIZERS_ONLY',
      });
    });
  });

  it('supports ordering changes and persists the new position', async () => {
    await renderPage();
    await screen.findByText('Attendee brief');

    fireEvent.click(
      screen.getByRole('button', { name: /move attendee brief up/i })
    );

    await waitFor(() => {
      expect(
        fetchBody(
          `/api/events/${eventId}/materials/${approvedFile.id}`,
          'PATCH'
        )
      ).toMatchObject({ position: expect.any(Number) });
    });
  });

  it('renders empty and load-error states without stale material rows', async () => {
    mockMaterialsFetch([]);
    await renderPage();
    expect(await screen.findByText(/no materials/i)).toBeInTheDocument();

    cleanup();
    global.fetch = jest.fn(() => jsonResponse({ error: 'Unavailable' }, 503));
    await renderPage();
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/materials.*unavailable/i);
    expect(screen.queryByText('Public schedule')).not.toBeInTheDocument();
  });

  it('requires confirmation and removes a material through the event-scoped API', async () => {
    const confirm = jest.spyOn(window, 'confirm').mockReturnValue(true);
    await renderPage();
    await screen.findByText('Sponsor contacts');

    fireEvent.click(
      screen.getByRole('button', { name: /delete sponsor contacts/i })
    );

    expect(confirm).toHaveBeenCalledWith(
      expect.stringMatching(/delete.*sponsor contacts/i)
    );
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        `/api/events/${eventId}/materials/${organizerFile.id}`,
        expect.objectContaining({ method: 'DELETE' })
      );
    });
    await waitFor(() => {
      expect(screen.queryByText('Sponsor contacts')).not.toBeInTheDocument();
    });
    confirm.mockRestore();
  });
});
