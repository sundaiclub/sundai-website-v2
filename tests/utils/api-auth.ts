import { NextRequest } from 'next/server';

type ClerkAuthResult = {
  userId: string | null;
  sessionId?: string | null;
  orgId?: string | null;
  orgRole?: string | null;
  orgSlug?: string | null;
  getToken?: jest.Mock<Promise<string | null>, []>;
  claims?: Record<string, unknown>;
};

type ClerkUserEmailAddress = {
  id: string;
  emailAddress: string;
};

export type MockClerkUser = {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  username?: string | null;
  imageUrl?: string;
  primaryEmailAddressId?: string | null;
  primaryEmailAddress?: ClerkUserEmailAddress | null;
  emailAddresses?: ClerkUserEmailAddress[];
  publicMetadata?: Record<string, unknown>;
  privateMetadata?: Record<string, unknown>;
  unsafeMetadata?: Record<string, unknown>;
};

export type MockClerkAuthOptions = Partial<Omit<ClerkAuthResult, 'userId'>> & {
  userId?: string | null;
};

export type JsonRequestOptions<TBody = unknown> = {
  method?: string;
  body?: TBody;
  headers?: HeadersInit;
  searchParams?:
    | URLSearchParams
    | Record<string, string | number | boolean | null | undefined>;
  origin?: string;
};

export type CurrentUserRegistrationAnswers = Record<string, unknown>;

export type CurrentUserRegistrationRequestBody = {
  answersJson: CurrentUserRegistrationAnswers;
  smsConsentGranted?: boolean;
};

export type CurrentUserRegistrationRequestOptions = Omit<
  JsonRequestOptions<CurrentUserRegistrationRequestBody>,
  'body' | 'method'
> & {
  answersJson?: CurrentUserRegistrationAnswers;
  smsConsentGranted?: boolean;
  body?: CurrentUserRegistrationRequestBody;
};

export type OrganizerRegistrationReviewRequestOptions = Omit<
  JsonRequestOptions,
  'body' | 'method'
>;

const defaultUserId = 'test-clerk-user-id';

const asMock = <TArgs extends unknown[], TResult>(fn: unknown) => {
  if (!jest.isMockFunction(fn)) {
    throw new Error(
      '@clerk/nextjs/server must be mocked before using tests/utils/api-auth. ' +
        "Add `jest.mock('@clerk/nextjs/server', () => require('../utils/api-auth').mockClerkServerModule())` before importing the route under test."
    );
  }

  return fn as jest.Mock<TResult, TArgs>;
};

const clerkServer = () => require('@clerk/nextjs/server');

const normalizeHeaders = (headers?: HeadersInit) => {
  const normalized = new Headers(headers);
  if (!normalized.has('content-type')) {
    normalized.set('content-type', 'application/json');
  }

  return normalized;
};

const appendSearchParams = (
  url: URL,
  searchParams?: JsonRequestOptions['searchParams']
) => {
  if (!searchParams) {
    return;
  }

  const entries =
    searchParams instanceof URLSearchParams
      ? searchParams.entries()
      : Object.entries(searchParams);

  for (const [key, value] of entries) {
    if (value === null || value === undefined) {
      continue;
    }

    url.searchParams.set(key, String(value));
  }
};

const searchParamsToRecord = (
  searchParams?: JsonRequestOptions['searchParams']
) => {
  if (!searchParams) {
    return {};
  }

  if (searchParams instanceof URLSearchParams) {
    return Object.fromEntries(searchParams.entries());
  }

  return { ...searchParams };
};

export function mockClerkServerModule() {
  return {
    __esModule: true,
    auth: jest.fn(),
    currentUser: jest.fn(),
  };
}

function getMockAuth() {
  return asMock<[], ClerkAuthResult>(clerkServer().auth);
}

function getMockCurrentUser() {
  return asMock<[], Promise<MockClerkUser | null>>(clerkServer().currentUser);
}

export function mockSignedOutClerk() {
  getMockAuth().mockReturnValue({
    userId: null,
    sessionId: null,
    orgId: null,
    orgRole: null,
    orgSlug: null,
    getToken: jest.fn().mockResolvedValue(null),
  });
  getMockCurrentUser().mockResolvedValue(null);
}

export function mockAuthenticatedClerk(options: MockClerkAuthOptions = {}) {
  const userId = options.userId ?? defaultUserId;
  const authResult: ClerkAuthResult = {
    userId,
    sessionId: options.sessionId ?? 'test-session-id',
    orgId: options.orgId ?? null,
    orgRole: options.orgRole ?? null,
    orgSlug: options.orgSlug ?? null,
    getToken: options.getToken ?? jest.fn().mockResolvedValue('test-token'),
    claims: options.claims,
  };

  getMockAuth().mockReturnValue(authResult);

  return authResult;
}

export function mockCurrentUser(user: Partial<MockClerkUser> | null = {}) {
  if (user === null) {
    getMockCurrentUser().mockResolvedValue(null);
    return null;
  }

  const userId = user.id ?? defaultUserId;
  const defaultPrimaryEmailAddress = {
    id: 'test-email-id',
    emailAddress: 'test@example.com',
  };
  const primaryEmailAddress =
    user.primaryEmailAddress === undefined
      ? defaultPrimaryEmailAddress
      : user.primaryEmailAddress;
  const clerkUser: MockClerkUser = {
    id: userId,
    firstName: user.firstName ?? 'Test',
    lastName: user.lastName ?? 'User',
    fullName: user.fullName ?? 'Test User',
    username: user.username ?? 'testuser',
    imageUrl: user.imageUrl ?? 'https://example.com/avatar.png',
    primaryEmailAddressId:
      user.primaryEmailAddressId ?? primaryEmailAddress?.id ?? null,
    primaryEmailAddress,
    emailAddresses:
      user.emailAddresses ?? (primaryEmailAddress ? [primaryEmailAddress] : []),
    publicMetadata: user.publicMetadata ?? {},
    privateMetadata: user.privateMetadata ?? {},
    unsafeMetadata: user.unsafeMetadata ?? {},
  };

  getMockCurrentUser().mockResolvedValue(clerkUser);

  return clerkUser;
}

export function mockAuthenticatedClerkUser(
  authOptions: MockClerkAuthOptions = {},
  user: Partial<MockClerkUser> = {}
) {
  const authResult = mockAuthenticatedClerk(authOptions);
  const clerkUser = mockCurrentUser({
    id: authResult.userId ?? defaultUserId,
    ...user,
  });

  return { authResult, clerkUser };
}

export function resetClerkMocks() {
  getMockAuth().mockReset();
  getMockCurrentUser().mockReset();
}

export function createJsonRequest<TBody = unknown>(
  path: string,
  options: JsonRequestOptions<TBody> = {}
) {
  const url = new URL(path, options.origin ?? 'http://localhost:3000');
  appendSearchParams(url, options.searchParams);

  const init: RequestInit = {
    method: options.method ?? (options.body === undefined ? 'GET' : 'POST'),
    headers: normalizeHeaders(options.headers),
  };

  if (options.body !== undefined) {
    init.body = JSON.stringify(options.body);
  }

  const request = new NextRequest(url.toString(), init);

  if (options.body !== undefined) {
    request.json = jest.fn().mockResolvedValue(options.body);
  }

  return request;
}

export function createDefaultCurrentUserRegistrationAnswers(): CurrentUserRegistrationAnswers {
  return {
    name: 'Test User',
    email: 'test@example.com',
    why_this_event: 'I want to build with the chapter.',
  };
}

export function createCurrentUserRegistrationRequest(
  eventId: string,
  options: CurrentUserRegistrationRequestOptions = {}
) {
  const { answersJson, smsConsentGranted, body, ...requestOptions } = options;

  return createJsonRequest(`/api/events/${eventId}/registrations`, {
    ...requestOptions,
    method: 'POST',
    body: body ?? {
      answersJson: answersJson ?? createDefaultCurrentUserRegistrationAnswers(),
      ...(smsConsentGranted !== undefined ? { smsConsentGranted } : {}),
    },
  });
}

export function createCurrentUserRegistrationEditRequest(
  eventId: string,
  options: CurrentUserRegistrationRequestOptions = {}
) {
  const { answersJson, smsConsentGranted, body, ...requestOptions } = options;

  return createJsonRequest(`/api/events/${eventId}/registrations/me`, {
    ...requestOptions,
    method: 'PATCH',
    body: body ?? {
      answersJson: answersJson ?? createDefaultCurrentUserRegistrationAnswers(),
      ...(smsConsentGranted !== undefined ? { smsConsentGranted } : {}),
    },
  });
}

export function createCurrentUserRegistrationCancelRequest(
  eventId: string,
  options: Omit<JsonRequestOptions, 'method' | 'body'> = {}
) {
  return createJsonRequest(`/api/events/${eventId}/registrations/me/cancel`, {
    ...options,
    method: 'POST',
  });
}

export function createSiteAdminIncludeBannedRegistrationsRequest(
  eventId: string,
  options: OrganizerRegistrationReviewRequestOptions = {}
) {
  return createJsonRequest(`/api/events/${eventId}/registrations`, {
    ...options,
    method: 'GET',
    searchParams: {
      ...searchParamsToRecord(options.searchParams),
      includeBannedUsers: true,
    },
  });
}

export function createRouteContext<TParams extends Record<string, string>>(
  params: TParams
) {
  return { params };
}
