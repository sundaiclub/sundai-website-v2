import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mockUseTheme = jest.fn();
const mockUseUserContext = jest.fn();
const mockUseParams = jest.fn();

jest.mock('../../src/app/contexts/ThemeContext', () => ({
  useTheme: () => mockUseTheme(),
}));

jest.mock('../../src/app/contexts/UserContext', () => ({
  useUserContext: () => mockUseUserContext(),
}));

jest.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
  usePathname: () => '/organizer/chapters/boston/settings',
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

type PageComponent = React.ComponentType<{ params?: { chapterSlug: string } }>;

const chapterAdminUser = {
  id: 'hacker-chapter-admin',
  clerkId: 'clerk-chapter-admin',
  name: 'Chapter Admin',
  email: 'chapter-admin@example.com',
  role: 'HACKER',
  roles: ['HACKER'],
  chapterMemberships: [
    {
      chapterId: 'chapter-boston',
      chapterSlug: 'boston',
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  ],
};

const regularUser = {
  id: 'hacker-regular',
  clerkId: 'clerk-regular',
  name: 'Regular Hacker',
  email: 'regular@example.com',
  role: 'HACKER',
  roles: ['HACKER'],
  chapterMemberships: [],
};

const chapter = {
  id: 'chapter-boston',
  name: 'Sundai Boston',
  slug: 'boston',
  city: 'Boston',
  region: 'MA',
  country: 'US',
  timezone: 'America/New_York',
  description: 'Boston chapter operations',
  heroImage: {
    id: 'image-boston',
    url: 'https://storage.googleapis.com/test-bucket/chapters/boston.jpg',
    alt: 'Sundai Boston chapter image',
    filename: 'boston.jpg',
  },
  status: 'ACTIVE',
  accessMode: 'PRIVATE',
  mailingListName: 'boston-organizers',
  memberships: [
    {
      id: 'membership-admin',
      role: 'ADMIN',
      status: 'ACTIVE',
      notificationsAllowed: true,
      emailNotificationsEnabled: true,
      smsNotificationsEnabled: false,
      hacker: {
        id: 'hacker-chapter-admin',
        name: 'Chapter Admin',
        email: 'chapter-admin@example.com',
      },
    },
  ],
  admins: [
    {
      id: 'membership-admin',
      hacker: {
        id: 'hacker-chapter-admin',
        name: 'Chapter Admin',
        email: 'chapter-admin@example.com',
      },
    },
  ],
};

const members = [
  {
    id: 'membership-admin',
    chapterId: chapter.id,
    hackerId: 'hacker-chapter-admin',
    role: 'ADMIN',
    status: 'ACTIVE',
    notificationsAllowed: true,
    emailNotificationsEnabled: true,
    smsNotificationsEnabled: false,
    hacker: {
      id: 'hacker-chapter-admin',
      name: 'Chapter Admin',
      email: 'chapter-admin@example.com',
    },
  },
  {
    id: 'membership-member',
    chapterId: chapter.id,
    hackerId: 'hacker-active-member',
    role: 'MEMBER',
    status: 'ACTIVE',
    notificationsAllowed: true,
    emailNotificationsEnabled: true,
    smsNotificationsEnabled: true,
    hacker: {
      id: 'hacker-active-member',
      name: 'Active Member',
      email: 'member@example.com',
    },
  },
  {
    id: 'membership-invited',
    chapterId: chapter.id,
    hackerId: 'hacker-invited',
    role: 'MEMBER',
    status: 'INVITED',
    notificationsAllowed: false,
    emailNotificationsEnabled: false,
    smsNotificationsEnabled: false,
    invitedBy: {
      id: 'hacker-chapter-admin',
      name: 'Chapter Admin',
      email: 'chapter-admin@example.com',
    },
    hacker: {
      id: 'hacker-invited',
      name: 'Invited Hacker',
      email: 'invited@example.com',
    },
  },
];

const templates = [
  {
    id: 'template-site',
    scope: 'SITE',
    name: 'Site required questions',
    isActive: true,
    fieldsJson: [
      { id: 'name', key: 'name', label: 'Name', type: 'TEXT', required: true },
      {
        id: 'email',
        key: 'email',
        label: 'Email',
        type: 'EMAIL',
        required: true,
      },
    ],
  },
  {
    id: 'template-chapter-boston',
    scope: 'CHAPTER',
    chapterId: chapter.id,
    name: 'Boston chapter application',
    isActive: true,
    fieldsJson: [
      {
        id: 'build_goal',
        key: 'build_goal',
        label: 'What are you hoping to build?',
        type: 'LONG_TEXT',
        required: false,
      },
    ],
  },
];

const banFlags = [
  {
    id: 'flag-boston-review',
    chapterId: chapter.id,
    hackerId: 'hacker-flagged',
    reason: 'Repeated no-show pattern',
    status: 'OPEN',
    hacker: {
      id: 'hacker-flagged',
      name: 'Flagged Hacker',
      email: 'flagged@example.com',
    },
    createdBy: {
      id: 'hacker-chapter-admin',
      name: 'Chapter Admin',
      email: 'chapter-admin@example.com',
    },
  },
];

function loadPage(route: string, modulePath: string): PageComponent {
  try {
    const mod = require(modulePath);
    if (!mod.default) {
      throw new Error('module did not export a default React component');
    }

    return mod.default;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Expected ${route} page module at ${modulePath}: ${message}`
    );
  }
}

function mockChapterAdmin() {
  mockUseUserContext.mockReturnValue({
    isAdmin: false,
    loading: false,
    userInfo: chapterAdminUser,
  });
}

function mockUnauthorizedUser() {
  mockUseUserContext.mockReturnValue({
    isAdmin: false,
    loading: false,
    userInfo: regularUser,
  });
}

function mockLoadingUser() {
  mockUseUserContext.mockReturnValue({
    isAdmin: false,
    loading: true,
    userInfo: null,
  });
}

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

function isApplicationTemplateListRequest(url: string) {
  return url === `/api/application-templates?chapterId=${chapter.id}`;
}

function mockOrganizerFetches() {
  global.fetch = jest.fn((input: RequestInfo | URL) => {
    const url = requestUrl(input);

    if (url.includes('/members')) {
      return jsonResponse(members);
    }

    if (url.includes('/invites')) {
      return jsonResponse(
        members.filter(member => member.status === 'INVITED')
      );
    }

    if (url.includes('/ban-flags')) {
      return jsonResponse(banFlags);
    }

    if (isApplicationTemplateListRequest(url)) {
      return jsonResponse(templates);
    }

    if (/\/api\/chapters\/[^/?]+/.test(url)) {
      return jsonResponse(chapter);
    }

    if (url.includes('/api/chapters')) {
      return jsonResponse([chapter]);
    }

    return jsonResponse({});
  }) as jest.Mock;
}

function mockForbiddenFetches() {
  global.fetch = jest.fn(() =>
    jsonResponse(
      { error: 'You do not have permission to view this page.' },
      403
    )
  ) as jest.Mock;
}

async function expectSomeText(...patterns: RegExp[]) {
  await waitFor(() => {
    expect(
      patterns.some(pattern => screen.queryAllByText(pattern).length > 0)
    ).toBe(true);
  });
}

async function expectAccessDenied() {
  await expectSomeText(
    /you do not have permission/i,
    /access denied/i,
    /not authorized/i,
    /forbidden/i
  );
}

function renderSettingsPage() {
  const OrganizerChapterSettingsPage = loadPage(
    '/organizer/chapters/[chapterSlug]/settings',
    '../../src/app/organizer/chapters/[chapterSlug]/settings/page'
  );

  render(<OrganizerChapterSettingsPage params={{ chapterSlug: 'boston' }} />);
}

describe('/organizer/chapters/[chapterSlug]/settings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseTheme.mockReturnValue({ isDarkMode: false });
    mockUseParams.mockReturnValue({ chapterSlug: 'boston' });
    mockOrganizerFetches();
  });

  it('renders the chapter settings organizer surface for chapter admins', async () => {
    mockChapterAdmin();

    renderSettingsPage();

    await expectSomeText(/sundai boston/i, /chapter settings/i);
    await expectSomeText(/private/i, /active/i);
    await expectSomeText(/chapter admin/i);
    await expectSomeText(/active member/i);
    await expectSomeText(/invited hacker/i, /invitations?/i);
    await expectSomeText(/admins?/i);
    await expectSomeText(/members?/i);
    await expectSomeText(/notification/i);
    await expectSomeText(
      /ban flags?/i,
      /flagged hacker/i,
      /repeated no-show pattern/i
    );
    await expectSomeText(
      /boston chapter application/i,
      /what are you hoping to build/i,
      /application template/i
    );
    expect(
      screen.queryByText(/site required questions/i)
    ).not.toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith(
      `/api/application-templates?chapterId=${chapter.id}`
    );
    await expectSomeText(/chapter profile/i, /chapter description/i);
    expect(screen.getByLabelText(/chapter image/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/chapter description/i)).toHaveValue(
      'Boston chapter operations'
    );
    expect(screen.getByLabelText(/timezone/i)).toHaveValue('America/New_York');

    expect(
      screen.getAllByRole('button', {
        name: /save|update|invite|remove|revoke|add/i,
      }).length
    ).toBeGreaterThan(0);
  });

  it('updates the chapter timezone from the profile form', async () => {
    mockChapterAdmin();
    renderSettingsPage();

    const timezone = await screen.findByLabelText(/timezone/i);
    fireEvent.change(timezone, { target: { value: 'Europe/Berlin' } });
    fireEvent.click(screen.getByRole('button', { name: /save profile/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        `/api/chapters/${chapter.id}`,
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({
            description: chapter.description,
            timezone: 'Europe/Berlin',
          }),
        })
      );
    });
  });

  it('updates chapter decision message defaults under Admins', async () => {
    mockChapterAdmin();
    const chapterWithDefaults = {
      ...chapter,
      defaultApprovalMessage: 'Boston approval default.',
      defaultWaitlistMessage: 'Boston waitlist default.',
      defaultRejectionMessage: 'Boston rejection default.',
    };

    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = requestUrl(input);
      if (url.includes('/members')) return jsonResponse(members);
      if (url.includes('/ban-flags')) return jsonResponse(banFlags);
      if (isApplicationTemplateListRequest(url)) return jsonResponse(templates);
      if (init?.method === 'PATCH') {
        return jsonResponse({
          ...chapterWithDefaults,
          defaultApprovalMessage: 'Updated Boston approval.',
          defaultWaitlistMessage: 'Updated Boston waitlist.',
          defaultRejectionMessage: 'Updated Boston rejection.',
        });
      }
      if (/\/api\/chapters\/[^/?]+/.test(url)) {
        return jsonResponse(chapterWithDefaults);
      }
      return jsonResponse({});
    }) as jest.Mock;

    renderSettingsPage();

    const approvalMessage = await screen.findByLabelText(
      /default approval message/i
    );
    const rejectionMessage = screen.getByLabelText(
      /default rejection message/i
    );
    const waitlistMessage = screen.getByLabelText(/default waitlist message/i);
    expect(approvalMessage).toHaveValue('Boston approval default.');
    expect(waitlistMessage).toHaveValue('Boston waitlist default.');
    expect(rejectionMessage).toHaveValue('Boston rejection default.');

    fireEvent.change(approvalMessage, {
      target: { value: 'Updated Boston approval.' },
    });
    fireEvent.change(rejectionMessage, {
      target: { value: 'Updated Boston rejection.' },
    });
    fireEvent.change(waitlistMessage, {
      target: { value: 'Updated Boston waitlist.' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: /save decision messages/i })
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        `/api/chapters/${chapter.id}`,
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({
            defaultApprovalMessage: 'Updated Boston approval.',
            defaultWaitlistMessage: 'Updated Boston waitlist.',
            defaultRejectionMessage: 'Updated Boston rejection.',
          }),
        })
      );
    });

    const adminHeading = screen.getByText('Admins');
    const banFlagsHeading = screen.getByText('Ban flags');
    const membersHeading = screen.getByText('Members');
    expect(
      adminHeading.compareDocumentPosition(approvalMessage) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      banFlagsHeading.compareDocumentPosition(membersHeading) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('keeps profile saving available after a chapter image upload', async () => {
    mockChapterAdmin();
    renderSettingsPage();

    const imageInput = await screen.findByLabelText(/chapter image/i);
    const image = new File(['image-bytes'], 'boston-new.jpg', {
      type: 'image/jpeg',
    });

    fireEvent.change(imageInput, { target: { files: [image] } });

    await screen.findByText(/chapter image uploaded/i);

    const description = screen.getByLabelText(/chapter description/i);
    fireEvent.change(description, {
      target: { value: 'Updated after the image upload' },
    });

    const saveButton = screen.getByRole('button', { name: /save profile/i });
    expect(saveButton).toBeEnabled();
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        `/api/chapters/${chapter.id}`,
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({
            description: 'Updated after the image upload',
            timezone: chapter.timezone,
          }),
        })
      );
    });
  });

  it('shows the size limit when a chapter image upload returns 413', async () => {
    mockChapterAdmin();
    renderSettingsPage();

    const imageInput = await screen.findByLabelText(/chapter image/i);
    const defaultFetch = (global.fetch as jest.Mock).getMockImplementation()!;
    (global.fetch as jest.Mock).mockImplementation(
      (input: RequestInfo | URL, init?: RequestInit) =>
        requestUrl(input).includes(`/api/chapters/${chapter.id}/image`)
          ? jsonResponse({}, 413)
          : defaultFetch(input, init)
    );

    fireEvent.change(imageInput, {
      target: {
        files: [new File(['image'], 'chapter.jpg', { type: 'image/jpeg' })],
      },
    });

    expect(
      await screen.findByText(
        /file too large\. image files must be smaller than 15 mb\./i
      )
    ).toBeInTheDocument();
  });

  it('creates a ban flag from the selected hacker search result', async () => {
    mockChapterAdmin();
    const createdFlag = {
      id: 'flag-active-member',
      chapterId: chapter.id,
      hackerId: 'hacker-active-member',
      reason: 'Repeated no-show pattern',
      status: 'OPEN',
      hacker: {
        id: 'hacker-active-member',
        name: 'Active Member',
        email: 'member@example.com',
      },
    };

    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = requestUrl(input);

      if (url.includes('/members')) return jsonResponse(members);
      if (url.includes('/invites')) {
        return jsonResponse(
          members.filter(member => member.status === 'INVITED')
        );
      }
      if (url.includes('/ban-flags') && init?.method === 'POST') {
        return jsonResponse(createdFlag, 201);
      }
      if (url.includes('/ban-flags')) return jsonResponse([]);
      if (isApplicationTemplateListRequest(url)) return jsonResponse(templates);
      if (/\/api\/chapters\/[^/?]+/.test(url)) return jsonResponse(chapter);
      return jsonResponse({});
    }) as jest.Mock;

    renderSettingsPage();

    await expectSomeText(/no ban flags are open/i);
    fireEvent.change(
      screen.getByRole('textbox', { name: /search hacker to flag/i }),
      {
        target: { value: 'Active' },
      }
    );
    await expectSomeText(/member@example.com/i);
    fireEvent.click(screen.getByRole('option', { name: /active member/i }));
    fireEvent.change(screen.getByRole('textbox', { name: /flag reason/i }), {
      target: { value: 'Repeated no-show pattern' },
    });
    fireEvent.click(screen.getByRole('button', { name: /create flag/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        `/api/chapters/${chapter.id}/ban-flags`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            hackerId: 'hacker-active-member',
            reason: 'Repeated no-show pattern',
          }),
        })
      );
    });
  });

  it('opens the admin picker and adds the selected hacker as an admin', async () => {
    mockChapterAdmin();
    const adminCandidate = {
      id: 'hacker-new-admin',
      name: 'New Admin',
      email: 'new-admin@example.com',
    };
    const createdAdmin = {
      id: 'membership-new-admin',
      chapterId: chapter.id,
      hackerId: adminCandidate.id,
      role: 'ADMIN',
      status: 'ACTIVE',
      notificationsAllowed: true,
      emailNotificationsEnabled: true,
      smsNotificationsEnabled: false,
      hacker: adminCandidate,
    };

    global.fetch = jest.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = requestUrl(input);

      if (url === '/api/hackers') return jsonResponse([adminCandidate]);
      if (
        url === `/api/chapters/${chapter.id}/admins` &&
        init?.method === 'POST'
      ) {
        return jsonResponse(createdAdmin, 201);
      }
      if (url.includes('/members')) return jsonResponse(members);
      if (url.includes('/ban-flags')) return jsonResponse(banFlags);
      if (isApplicationTemplateListRequest(url)) return jsonResponse(templates);
      if (/\/api\/chapters\/[^/?]+/.test(url)) return jsonResponse(chapter);
      return jsonResponse({});
    }) as jest.Mock;

    renderSettingsPage();

    await screen.findByText('Sundai Boston');
    fireEvent.click(screen.getByRole('button', { name: /invite admin/i }));

    expect(
      await screen.findByRole('heading', { name: /invite chapter admin/i })
    ).toBeInTheDocument();
    const searchInput = screen.getByPlaceholderText(/search members/i);
    expect(global.fetch).toHaveBeenCalledWith('/api/hackers');

    fireEvent.change(searchInput, { target: { value: 'New Admin' } });
    fireEvent.click(screen.getByRole('button', { name: /new admin/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        `/api/chapters/${chapter.id}/admins`,
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ hackerId: adminCandidate.id }),
        })
      );
    });
    expect(
      await screen.findByText('New Admin is now a chapter admin.')
    ).toBeInTheDocument();
    expect(screen.getAllByText('new-admin@example.com').length).toBeGreaterThan(
      0
    );
  });

  it('denies the organizer settings surface to users who do not manage the chapter', async () => {
    mockUnauthorizedUser();
    mockForbiddenFetches();

    renderSettingsPage();

    await expectAccessDenied();
    expect(screen.queryByText(/active member/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/invited hacker/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/repeated no-show pattern/i)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText(/chapter description/i)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: /save|update|invite|remove|revoke|add/i,
      })
    ).not.toBeInTheDocument();
  });

  it('shows loading instead of access denied while auth is still resolving', async () => {
    mockLoadingUser();
    mockForbiddenFetches();

    renderSettingsPage();

    await waitFor(() => {
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });
    expect(
      screen.queryByText('You do not have permission to view this page.')
    ).not.toBeInTheDocument();
  });
});
