import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type {
  PublicEventDetail,
  PublicViewerRegistrationState,
  RegistrationStatus,
  TemplateFieldDefinition,
} from '../../src/types/event-management';
import { publicCalendarPayloadFixture } from '../utils/event-rsvp-fixtures';
import { getPublicEventBySlug } from '@/lib/publicEvents';

const mockUseTheme = jest.fn();
const mockUseUserContext = jest.fn();
const mockUseParams = jest.fn();
const mockUseUser = jest.fn();
const mockUseAuth = jest.fn();
const mockServerAuth = jest.fn();
const mockCurrentUser = jest.fn();
const mockNotFound = jest.fn();

jest.mock('../../src/app/contexts/ThemeContext', () => ({
  useTheme: () => mockUseTheme(),
}));

jest.mock('../../src/app/contexts/UserContext', () => ({
  useUserContext: () => mockUseUserContext(),
}));

jest.mock('next/navigation', () => ({
  useParams: () => mockUseParams(),
  usePathname: () => '/events/boston/ai-build-night',
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
  }),
  notFound: () => mockNotFound(),
}));

jest.mock('@clerk/nextjs', () => ({
  useUser: () => mockUseUser(),
  useAuth: () => mockUseAuth(),
  SignInButton: ({ children }: { children: React.ReactNode }) => (
    <button type="button">{children}</button>
  ),
  UserButton: () => <div>User Button</div>,
}));

jest.mock('@clerk/nextjs/server', () => ({
  auth: () => mockServerAuth(),
  currentUser: () => mockCurrentUser(),
}));

jest.mock('@/lib/publicEvents', () => ({
  getPublicEventBySlug: jest.fn(),
}));

type PageComponent = React.ComponentType<{
  params?: { chapterSlug: string; eventSlug: string };
}>;

const mockGetPublicEventBySlug = getPublicEventBySlug as jest.Mock;
const routeParams = { chapterSlug: 'boston', eventSlug: 'ai-build-night' };
const eventFixture = publicCalendarPayloadFixture.event;
const approvedOnlyDetails = {
  address: '42 Private Lane',
  arrivalInstructions: 'Use the loading dock entrance.',
  calendarDescription:
    'Approved attendees should enter through the side door and check in with the host.',
};

const publicMaterial = {
  id: 'material-public-guide',
  eventId: eventFixture.id,
  kind: 'LINK',
  visibility: 'PUBLIC',
  title: 'Public build night guide',
  description: 'What to bring and how the event works.',
  externalUrl: 'https://example.com/public-guide',
  originalFilename: null,
  mimeType: null,
  size: null,
  position: 10,
  isAvailable: true,
  availableFrom: null,
  availableUntil: null,
  createdById: 'hacker-organizer',
  createdAt: '2026-07-01T12:00:00.000Z',
  updatedAt: '2026-07-01T12:00:00.000Z',
};

const approvedMaterial = {
  ...publicMaterial,
  id: 'material-approved-brief',
  kind: 'FILE',
  visibility: 'APPROVED_ATTENDEES',
  title: 'Approved attendee brief',
  description: 'Arrival and workshop preparation.',
  externalUrl: null,
  originalFilename: 'attendee-brief.pdf',
  mimeType: 'application/pdf',
  size: 481_230,
  position: 20,
  contentUrl: `/api/events/${eventFixture.id}/materials/material-approved-brief/content`,
};

const organizerMaterialWithPrivateMetadata = {
  ...approvedMaterial,
  id: 'material-organizer-runbook',
  visibility: 'ORGANIZERS_ONLY',
  title: 'Organizer incident runbook',
  description: 'Private escalation instructions.',
  originalFilename: 'incident-runbook.pdf',
  objectKey: 'events/private/opaque-object-key',
  bucket: 'private-event-materials',
  uploadToken: 'private-upload-token',
  contentUrl: `/api/events/${eventFixture.id}/materials/material-organizer-runbook/content`,
};

const signedOutUser = null;

const signedInUser = {
  id: 'hacker-current',
  clerkId: 'clerk-current',
  name: 'Current Hacker',
  email: 'current@example.com',
  role: 'HACKER',
  roles: ['HACKER'],
  chapterMemberships: [],
};

function applicationField(
  id: string,
  overrides: Partial<TemplateFieldDefinition> = {}
): TemplateFieldDefinition {
  return {
    id,
    label: id,
    type: 'TEXT',
    required: false,
    ...overrides,
  };
}

const applicationQuestionSet = {
  siteFields: [
    applicationField('name', {
      label: 'Full name',
      required: true,
      siteRequired: true,
    }),
    applicationField('email', {
      label: 'Email',
      type: 'EMAIL',
      required: true,
      siteRequired: true,
    }),
  ],
  chapterFields: [
    applicationField('chapterGoals', {
      label: 'Chapter goals',
      type: 'TEXTAREA',
      required: false,
    }),
  ],
  eventFields: [
    applicationField('project', {
      label: 'Project idea',
      type: 'TEXTAREA',
      required: true,
      placeholder: 'What do you want to build?',
    }),
  ],
  composedFields: [
    applicationField('name', {
      label: 'Full name',
      required: true,
      siteRequired: true,
      order: 0,
    }),
    applicationField('email', {
      label: 'Email',
      type: 'EMAIL',
      required: true,
      siteRequired: true,
      order: 1,
    }),
    applicationField('chapterGoals', {
      label: 'Chapter goals',
      type: 'TEXTAREA',
      required: false,
      order: 2,
    }),
    applicationField('project', {
      label: 'Project idea',
      type: 'TEXTAREA',
      required: true,
      placeholder: 'What do you want to build?',
      order: 3,
    }),
  ],
  eventId: eventFixture.id,
};

function registrationState(
  status: RegistrationStatus,
  overrides: Partial<PublicViewerRegistrationState> = {}
): PublicViewerRegistrationState {
  const canCancel =
    status === 'PENDING' || status === 'APPROVED' || status === 'WAITLISTED';

  return {
    id: `registration-${status.toLowerCase()}`,
    status,
    submittedAt: '2026-06-18T15:00:00.000Z',
    cancelledAt: status === 'CANCELLED' ? '2026-06-19T15:00:00.000Z' : null,
    publicSafeMessage: null,
    canEditAnswers: status === 'PENDING',
    canCancel,
    answersJson: {
      name: signedInUser.name,
      email: signedInUser.email,
      chapterGoals: 'Meet other Boston builders.',
      project: 'Scheduler prototype',
    },
    ...overrides,
  };
}

function buildEventDetail(
  overrides: Partial<PublicEventDetail> = {}
): PublicEventDetail {
  return {
    id: eventFixture.id,
    slug: eventFixture.slug,
    chapterSlug: eventFixture.chapter.slug,
    chapterName: eventFixture.chapter.name,
    chapter: eventFixture.chapter,
    title: eventFixture.title,
    publicLocation: eventFixture.publicLocation,
    startTime: eventFixture.startTime,
    endTime: eventFixture.endTime,
    publicStatus: 'OPEN',
    viewerRegistrationStatus: null,
    description: publicCalendarPayloadFixture.publicDescription,
    publicProgramLabel: 'Builder sprint',
    publicSponsorText: 'Community dinner sponsored by Sundai partners.',
    publicExpertText:
      'Expert mentors will be available for AI product feedback.',
    approvedDetailsJson: null,
    approvedDetailsVisible: false,
    applicationControls: {
      applicationMode: 'REQUIRES_APPROVAL',
      applicationsOpen: true,
      capacity: 40,
      approvedCount: 12,
      autoPromoteWaitlist: false,
      publicStatus: 'OPEN',
      canSubmit: false,
      canEditAnswers: false,
      canCancelRegistration: false,
      signInRequired: true,
      publicMessage: 'Sign in to apply for this event.',
    },
    applicationQuestionSet: {
      siteFields: [],
      chapterFields: [],
      eventFields: [],
      composedFields: [],
      eventId: eventFixture.id,
    },
    viewerRegistration: null,
    addToCalendar: publicCalendarPayloadFixture.publicPayload,
    ...overrides,
  };
}

function buildApplicationEvent(
  overrides: Partial<PublicEventDetail> = {}
): PublicEventDetail {
  return buildEventDetail({
    applicationQuestionSet,
    applicationControls: {
      ...buildEventDetail().applicationControls,
      canSubmit: true,
      signInRequired: false,
      publicMessage: null,
    },
    ...overrides,
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

function mockSignedOut() {
  mockUseUserContext.mockReturnValue({
    isAdmin: false,
    loading: false,
    userInfo: signedOutUser,
  });
  mockUseUser.mockReturnValue({
    isLoaded: true,
    isSignedIn: false,
    user: null,
  });
  mockUseAuth.mockReturnValue({
    isLoaded: true,
    isSignedIn: false,
    userId: null,
  });
  mockServerAuth.mockReturnValue({ userId: null });
  mockCurrentUser.mockResolvedValue(null);
}

function mockSignedIn() {
  mockUseUserContext.mockReturnValue({
    isAdmin: false,
    loading: false,
    userInfo: signedInUser,
  });
  mockUseUser.mockReturnValue({
    isLoaded: true,
    isSignedIn: true,
    user: {
      id: signedInUser.clerkId,
      fullName: signedInUser.name,
      emailAddresses: [{ emailAddress: signedInUser.email }],
    },
  });
  mockUseAuth.mockReturnValue({
    isLoaded: true,
    isSignedIn: true,
    userId: signedInUser.clerkId,
  });
  mockServerAuth.mockReturnValue({ userId: signedInUser.clerkId });
  mockCurrentUser.mockResolvedValue({
    id: signedInUser.clerkId,
    fullName: signedInUser.name,
    username: 'currenthacker',
    primaryEmailAddress: { emailAddress: signedInUser.email },
  });
}

function mockEventFetches(event: PublicEventDetail | null) {
  global.fetch = jest.fn((input: RequestInfo | URL) => {
    const url = requestUrl(input);

    if (url.includes('/api/events')) {
      if (!event) return jsonResponse({ message: 'Not Found' }, 404);
      return jsonResponse({ ...event, event, item: event, data: event });
    }

    return jsonResponse({});
  }) as jest.Mock;
}

async function renderDetailPage(event: PublicEventDetail | null) {
  mockGetPublicEventBySlug.mockResolvedValue(event);
  mockEventFetches(event);
  mockUseParams.mockReturnValue(routeParams);

  const EventDetailPage = loadPage(
    '/events/[chapterSlug]/[eventSlug]',
    '../../src/app/events/[chapterSlug]/[eventSlug]/page'
  );

  if (EventDetailPage.constructor.name === 'AsyncFunction') {
    const element = await (
      EventDetailPage as unknown as (props: {
        params: typeof routeParams;
      }) => Promise<React.ReactElement>
    )({ params: routeParams });
    render(element);
    return;
  }

  render(<EventDetailPage params={routeParams} />);
}

async function expectSomeText(...patterns: RegExp[]) {
  await waitFor(() => {
    expect(
      patterns.some(pattern => screen.queryAllByText(pattern).length > 0)
    ).toBe(true);
  });
}

async function findCalendarAction() {
  const link = screen.queryByRole('link', { name: /add.*calendar/i });
  if (link) return link;

  return screen.findByRole('button', { name: /add.*calendar/i });
}

async function openRegistrationForm() {
  const registerButton = await screen.findByRole('button', {
    name: /^register$/i,
  });
  fireEvent.click(registerButton);
}

describe('/events/[chapterSlug]/[eventSlug] public detail page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseTheme.mockReturnValue({ isDarkMode: false });
    mockSignedOut();
  });

  it('renders published public event fields for anonymous visitors', async () => {
    await renderDetailPage(buildEventDetail());

    await expectSomeText(/ai build night/i);
    await expectSomeText(/sundai boston/i);
    await expectSomeText(/bring a laptop and a project idea/i);
    await expectSomeText(/builder sprint/i);
    await expectSomeText(/community dinner sponsored/i);
    await expectSomeText(/expert mentors/i);
    await expectSomeText(/boston, ma/i);
    await expectSomeText(/july 10, 2026/i);
    await expectSomeText(/6:00\s*pm|6 pm/i);
    await expectSomeText(/sign in/i);
    expect(
      screen.getByRole('link', { name: /back to sundai boston/i })
    ).toHaveAttribute('href', '/chapters/boston');
    expect(
      screen.queryByRole('link', { name: /edit event/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('link', { name: /manage attendees/i })
    ).not.toBeInTheDocument();
  });

  it('shows an event settings action to admins', async () => {
    mockSignedIn();

    await renderDetailPage(
      buildEventDetail({
        viewerCanEditEvent: true,
      })
    );

    expect(screen.getByRole('link', { name: /edit event/i })).toHaveAttribute(
      'href',
      `/organizer/events/${eventFixture.id}/settings`
    );
  });

  it('links admins and event MCs to attendee management', async () => {
    mockSignedIn();

    await renderDetailPage(
      buildEventDetail({
        viewerCanManageRegistrations: true,
      })
    );

    expect(
      screen.getByRole('link', { name: /manage attendees/i })
    ).toHaveAttribute(
      'href',
      `/organizer/events/${eventFixture.id}/registrations`
    );
  });

  it('loads signed-in viewer status instead of anonymous application controls', async () => {
    mockSignedIn();

    await renderDetailPage(buildApplicationEvent());

    expect(mockGetPublicEventBySlug).toHaveBeenCalledWith({
      chapterSlug: 'boston',
      eventSlug: 'ai-build-night',
      viewer: { clerkId: signedInUser.clerkId },
      includeApprovedCalendarDetails: true,
    });
    expect(
      screen.queryByText(/sign in to (?:register|apply) for this event/i)
    ).not.toBeInTheDocument();
  });

  it('hides approved-only details until the viewer is approved', async () => {
    await renderDetailPage(
      buildEventDetail({
        approvedDetailsVisible: false,
        approvedDetailsJson: approvedOnlyDetails,
        viewerRegistrationStatus: 'PENDING',
        viewerRegistration: {
          id: 'registration-pending',
          status: 'PENDING',
          submittedAt: '2026-06-20T15:00:00.000Z',
          cancelledAt: null,
          publicSafeMessage: null,
          canEditAnswers: true,
          canCancel: true,
          answersJson: null,
        },
      })
    );

    await expectSomeText(/ai build night/i);
    expect(screen.queryByText(/42 private lane/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/loading dock entrance/i)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/enter through the side door/i)
    ).not.toBeInTheDocument();
  });

  it('shows a closed-applications state without opening the application form', async () => {
    mockSignedIn();

    await renderDetailPage(
      buildApplicationEvent({
        publicStatus: 'CLOSED',
        applicationControls: {
          ...buildApplicationEvent().applicationControls,
          applicationsOpen: false,
          applicationsClosedAt: '2026-06-22T15:00:00.000Z',
          applicationsCloseReason: 'Organizer capacity review',
          publicStatus: 'CLOSED',
          canSubmit: false,
          canEditAnswers: false,
          canCancelRegistration: false,
          signInRequired: false,
          publicMessage: 'Applications are closed for this event.',
        },
      })
    );

    await expectSomeText(/applications are closed for this event/i);
    expect(
      screen.queryByRole('button', {
        name: /register|submit application|apply|save.*changes|update application/i,
      })
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/full name/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/project idea/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/42 private lane/i)).not.toBeInTheDocument();
  });

  it('shows approved-only details and approved current-user status to approved viewers', async () => {
    mockSignedIn();

    await renderDetailPage(
      buildEventDetail({
        approvedDetailsVisible: true,
        approvedDetailsJson: approvedOnlyDetails,
        viewerRegistrationStatus: 'APPROVED',
        viewerRegistration: {
          id: 'registration-approved',
          status: 'APPROVED',
          submittedAt: '2026-06-18T15:00:00.000Z',
          cancelledAt: null,
          publicSafeMessage: 'You are approved for this event.',
          canEditAnswers: false,
          canCancel: true,
          answersJson: { project: 'Scheduler prototype' },
        },
        applicationControls: {
          ...buildEventDetail().applicationControls,
          canSubmit: false,
          canEditAnswers: false,
          canCancelRegistration: true,
          signInRequired: false,
          publicMessage: 'You are approved for this event.',
        },
        addToCalendar: publicCalendarPayloadFixture.approvedPayload,
      })
    );

    await expectSomeText(/approved/i);
    await expectSomeText(/42 private lane/i);
    await expectSomeText(/loading dock entrance/i);
    await expectSomeText(/you are approved for this event/i);
  });

  it('renders only public material links for anonymous and non-approved viewers', async () => {
    await renderDetailPage(
      buildEventDetail({
        viewerRegistrationStatus: 'PENDING',
        materials: [publicMaterial],
      } as any)
    );

    expect(
      await screen.findByRole('heading', { name: /event materials/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /public build night guide/i })
    ).toHaveAttribute('href', publicMaterial.externalUrl);
    expect(
      screen.queryByText(/approved attendee brief/i)
    ).not.toBeInTheDocument();
  });

  it('renders public and approved-attendee materials for an approved viewer', async () => {
    mockSignedIn();

    await renderDetailPage(
      buildEventDetail({
        viewerRegistrationStatus: 'APPROVED',
        viewerRegistration: registrationState('APPROVED'),
        materials: [publicMaterial, approvedMaterial],
      } as any)
    );

    expect(
      await screen.findByRole('link', { name: /public build night guide/i })
    ).toHaveAttribute('href', publicMaterial.externalUrl);
    expect(
      screen.getByRole('link', { name: /approved attendee brief/i })
    ).toHaveAttribute('href', approvedMaterial.contentUrl);
  });

  it('never renders organizer-only rows or private storage metadata on the public event surface', async () => {
    mockSignedIn();

    await renderDetailPage(
      buildEventDetail({
        viewerRegistrationStatus: 'APPROVED',
        viewerRegistration: registrationState('APPROVED'),
        materials: [
          publicMaterial,
          approvedMaterial,
          organizerMaterialWithPrivateMetadata,
        ],
      } as any)
    );

    expect(
      await screen.findByRole('heading', { name: /event materials/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByText(organizerMaterialWithPrivateMetadata.title)
    ).not.toBeInTheDocument();
    expect(document.body.textContent).not.toContain(
      organizerMaterialWithPrivateMetadata.objectKey
    );
    expect(document.body.textContent).not.toContain(
      organizerMaterialWithPrivateMetadata.bucket
    );
    expect(document.body.textContent).not.toContain(
      organizerMaterialWithPrivateMetadata.uploadToken
    );
    expect(
      screen.queryByRole('link', {
        name: /organizer incident runbook/i,
      })
    ).not.toBeInTheDocument();
  });

  it('shows waitlisted status without approved-only details', async () => {
    mockSignedIn();

    await renderDetailPage(
      buildApplicationEvent({
        approvedDetailsVisible: false,
        approvedDetailsJson: approvedOnlyDetails,
        viewerRegistrationStatus: 'WAITLISTED',
        viewerRegistration: {
          ...registrationState('WAITLISTED', {
            canEditAnswers: false,
            canCancel: true,
            publicSafeMessage: 'You are on the waitlist for this event.',
          }),
        } as PublicViewerRegistrationState,
        applicationControls: {
          ...buildApplicationEvent().applicationControls,
          canSubmit: false,
          canEditAnswers: false,
          canCancelRegistration: true,
          signInRequired: false,
          publicMessage: 'You are on the waitlist for this event.',
        },
      })
    );

    await expectSomeText(/waitlisted/i);
    await expectSomeText(/you are on the waitlist for this event/i);
    expect(screen.queryByText(/42 private lane/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/loading dock entrance/i)
    ).not.toBeInTheDocument();
  });

  it('reveals approved-only details after automatic waitlist promotion approves the viewer', async () => {
    mockSignedIn();

    await renderDetailPage(
      buildEventDetail({
        approvedDetailsVisible: true,
        approvedDetailsJson: approvedOnlyDetails,
        viewerRegistrationStatus: 'APPROVED',
        viewerRegistration: registrationState('APPROVED', {
          publicSafeMessage:
            'A spot opened and you are approved for this event.',
          canEditAnswers: false,
          canCancel: true,
        }),
        applicationControls: {
          ...buildEventDetail().applicationControls,
          approvedCount: 40,
          autoPromoteWaitlist: true,
          canSubmit: false,
          canEditAnswers: false,
          canCancelRegistration: true,
          signInRequired: false,
          publicMessage: 'A spot opened and you are approved for this event.',
        },
        addToCalendar: publicCalendarPayloadFixture.approvedPayload,
      })
    );

    await expectSomeText(/approved/i);
    await expectSomeText(/a spot opened and you are approved/i);
    await expectSomeText(/42 private lane/i);
    await expectSomeText(/loading dock entrance/i);
    await expectSomeText(/enter through the side door/i);
    expect(screen.queryByText(/waitlisted/i)).not.toBeInTheDocument();
  });

  it('shows pending current-user status with edit and cancellation controls', async () => {
    mockSignedIn();

    await renderDetailPage(
      buildEventDetail({
        viewerRegistrationStatus: 'PENDING',
        viewerRegistration: {
          id: 'registration-pending',
          status: 'PENDING',
          submittedAt: '2026-06-18T15:00:00.000Z',
          cancelledAt: null,
          publicSafeMessage: 'Your application is pending review.',
          canEditAnswers: true,
          canCancel: true,
          answersJson: { project: 'Scheduler prototype' },
        },
        applicationControls: {
          ...buildEventDetail().applicationControls,
          canSubmit: false,
          canEditAnswers: true,
          canCancelRegistration: true,
          signInRequired: false,
          publicMessage: 'Your application is pending review.',
        },
      })
    );

    await expectSomeText(/pending/i);
    await expectSomeText(/your application is pending review/i);
    expect(
      screen.getByRole('button', { name: /edit.*application|edit.*answers/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: /cancel.*registration|cancel.*application/i,
      })
    ).toBeInTheDocument();
    expect(screen.queryByText(/42 private lane/i)).not.toBeInTheDocument();
  });

  it('provides an add-to-calendar action using the public calendar payload', async () => {
    await renderDetailPage(buildEventDetail());

    const calendarAction = await findCalendarAction();
    expect(calendarAction).toBeInTheDocument();

    if (calendarAction.tagName.toLowerCase() === 'a') {
      expect(calendarAction).toHaveAttribute(
        'href',
        expect.stringMatching(/calendar|\.ics|data:text\/calendar/i)
      );
      expect(
        decodeURIComponent(calendarAction.getAttribute('href') ?? '')
      ).toEqual(expect.stringMatching(/AI Build Night|20260710T220000Z/i));
      return;
    }

    fireEvent.click(calendarAction);
    await waitFor(() => {
      expect(calendarAction).toBeEnabled();
    });
  });

  describe('signed-in application loop', () => {
    beforeEach(() => {
      mockSignedIn();
    });

    it('reveals the composed registration form from the register button with profile prefill', async () => {
      await renderDetailPage(buildApplicationEvent());

      expect(screen.queryByLabelText(/full name/i)).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: /^register$/i })).toBeEnabled();

      await openRegistrationForm();

      const nameInput = await screen.findByLabelText(/full name/i);
      const emailInput = screen.getByLabelText(/email/i);
      const chapterGoalsInput = screen.getByLabelText(/chapter goals/i);
      const projectInput = screen.getByLabelText(/project idea/i);

      expect(nameInput).toHaveValue(signedInUser.name);
      expect(emailInput).toHaveValue(signedInUser.email);
      expect(
        nameInput.compareDocumentPosition(emailInput) &
          Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
      expect(
        emailInput.compareDocumentPosition(chapterGoalsInput) &
          Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
      expect(
        chapterGoalsInput.compareDocumentPosition(projectInput) &
          Node.DOCUMENT_POSITION_FOLLOWING
      ).toBeTruthy();
      expect(
        screen.getByRole('button', {
          name: /submit application|apply/i,
        })
      ).toBeEnabled();
    });

    it('renders boolean application questions as checkboxes', async () => {
      const event = buildApplicationEvent();
      const checkboxField = applicationField('eventGuidelines', {
        label: 'I agree to the event guidelines',
        type: 'BOOLEAN',
        required: true,
        order: event.applicationQuestionSet.composedFields.length,
      });

      await renderDetailPage({
        ...event,
        applicationQuestionSet: {
          ...event.applicationQuestionSet,
          eventFields: [
            ...event.applicationQuestionSet.eventFields,
            checkboxField,
          ],
          composedFields: [
            ...event.applicationQuestionSet.composedFields,
            checkboxField,
          ],
        },
      });

      await openRegistrationForm();

      expect(
        screen.getByRole('checkbox', {
          name: /i agree to the event guidelines/i,
        })
      ).not.toBeChecked();
    });

    it('shows required-field errors before submitting incomplete application answers', async () => {
      await renderDetailPage(buildApplicationEvent());

      await openRegistrationForm();

      fireEvent.change(await screen.findByLabelText(/project idea/i), {
        target: { value: '' },
      });
      fireEvent.click(
        screen.getByRole('button', {
          name: /submit application|apply/i,
        })
      );

      expect(
        await screen.findByText(/project idea is required/i)
      ).toBeInTheDocument();
    });

    it('opens pending edit mode with submitted answers and preserves the original submitted timestamp', async () => {
      await renderDetailPage(
        buildApplicationEvent({
          viewerRegistrationStatus: 'PENDING',
          viewerRegistration: registrationState('PENDING'),
          applicationControls: {
            ...buildApplicationEvent().applicationControls,
            canSubmit: false,
            canEditAnswers: true,
            canCancelRegistration: true,
            publicMessage: 'Your application is pending review.',
          },
        })
      );

      fireEvent.click(
        await screen.findByRole('button', {
          name: /edit.*application|edit.*answers/i,
        })
      );

      expect(
        screen.getByDisplayValue('Scheduler prototype')
      ).toBeInTheDocument();
      expect(
        screen.getByDisplayValue('Meet other Boston builders.')
      ).toBeInTheDocument();
      await expectSomeText(/submitted/i, /june 18, 2026|jun 18, 2026/i);
      expect(
        screen.getByRole('button', {
          name: /save.*changes|update application/i,
        })
      ).toBeEnabled();
    });

    it.each([
      {
        status: 'APPROVED' as const,
        message: 'You are approved for this event.',
        canCancel: true,
      },
      {
        status: 'WAITLISTED' as const,
        message: 'You are on the waitlist for this event.',
        canCancel: true,
      },
      {
        status: 'DECLINED' as const,
        message: 'We cannot accommodate this cohort size.',
        canCancel: false,
      },
      {
        status: 'CANCELLED' as const,
        message: 'Your registration has been cancelled.',
        canCancel: false,
      },
    ])(
      'locks application editing for $status registrations while rendering the correct cancellation controls',
      async ({ status, message, canCancel }) => {
        await renderDetailPage(
          buildApplicationEvent({
            viewerRegistrationStatus: status,
            viewerRegistration: registrationState(status, {
              canCancel,
              canEditAnswers: false,
              publicSafeMessage: message,
            }),
            applicationControls: {
              ...buildApplicationEvent().applicationControls,
              canSubmit: false,
              canEditAnswers: false,
              canCancelRegistration: canCancel,
              publicMessage: message,
            },
          })
        );

        await expectSomeText(new RegExp(message, 'i'));
        expect(
          screen.queryByRole('button', {
            name: /edit.*application|edit.*answers/i,
          })
        ).not.toBeInTheDocument();
        expect(
          screen.queryByRole('button', {
            name: /register|submit application|apply|save.*changes|update application/i,
          })
        ).not.toBeInTheDocument();

        const cancelAction = screen.queryByRole('button', {
          name: /cancel.*registration|cancel.*application/i,
        });
        if (canCancel) {
          expect(cancelAction).toBeEnabled();
        } else {
          expect(cancelAction).not.toBeInTheDocument();
        }
      }
    );

    it.each([
      {
        status: 'BLOCKED' as const,
        safeMessage: 'You are unable to register for this event at this time.',
        unsafeMessage: 'Blocked by global ban policy.',
      },
      {
        status: 'DECLINED' as const,
        safeMessage: 'We cannot accommodate this cohort size.',
        unsafeMessage: 'Organizer internal reason: no founder fit.',
      },
    ])(
      'renders only the public-safe message for $status viewers',
      async ({ status, safeMessage, unsafeMessage }) => {
        await renderDetailPage(
          buildApplicationEvent({
            viewerRegistrationStatus: status,
            viewerRegistration: registrationState(status, {
              canEditAnswers: false,
              canCancel: false,
              publicSafeMessage: unsafeMessage,
            }),
            applicationControls: {
              ...buildApplicationEvent().applicationControls,
              canSubmit: false,
              canEditAnswers: false,
              canCancelRegistration: false,
              publicMessage: safeMessage,
            },
          })
        );

        await expectSomeText(new RegExp(safeMessage, 'i'));
        expect(screen.queryByText(unsafeMessage)).not.toBeInTheDocument();
        expect(
          screen.queryByText(/global ban|internal reason/i)
        ).not.toBeInTheDocument();
        expect(
          screen.queryByRole('button', {
            name: /edit.*application|edit.*answers|cancel.*registration/i,
          })
        ).not.toBeInTheDocument();
      }
    );
  });
});
