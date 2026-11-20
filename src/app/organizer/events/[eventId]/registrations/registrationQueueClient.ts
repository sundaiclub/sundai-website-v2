import type {
  OrganizerRegistrationReviewState,
  RegistrationReviewOrder,
  RegistrationStatus,
} from '@/types/event-management';

export type RegistrationQueueQuery = {
  status: RegistrationStatus;
  includeBannedUsers: boolean;
  order: RegistrationReviewOrder;
  search: string;
};

export const DEFAULT_REGISTRATION_QUEUE_QUERY: RegistrationQueueQuery = {
  status: 'PENDING',
  includeBannedUsers: false,
  order: 'oldest',
  search: '',
};

export type RegistrationQueueResult =
  | { ok: true; state: OrganizerRegistrationReviewState }
  | { ok: false; status: number };

const PREFETCH_MAX_AGE_MS = 10_000;
const prefetched = new Map<
  string,
  { startedAt: number; result: Promise<RegistrationQueueResult> }
>();

export function registrationQueueKey(query: RegistrationQueueQuery) {
  return [
    query.status,
    query.includeBannedUsers ? 'banned' : 'visible',
    query.order,
    query.search.trim(),
  ].join('|');
}

export function registrationQueueUrl(
  eventId: string,
  query: RegistrationQueueQuery,
  skip = 0
) {
  const params = new URLSearchParams({
    status: query.status,
    order: query.order,
  });
  if (query.includeBannedUsers) params.set('includeBannedUsers', 'true');
  const search = query.search.trim();
  if (search) params.set('q', search);
  if (skip > 0) params.set('skip', String(skip));
  return `/api/events/${eventId}/registrations?${params.toString()}`;
}

async function requestRegistrationQueue(
  url: string
): Promise<RegistrationQueueResult> {
  try {
    const response = await fetch(url);
    if (!response.ok) return { ok: false, status: response.status };
    return {
      ok: true,
      state: (await response.json()) as OrganizerRegistrationReviewState,
    };
  } catch {
    return { ok: false, status: 0 };
  }
}

/**
 * Starts loading the default RSVP queue before the page mounts, so the list
 * request runs alongside the workspace request instead of after it.
 */
export function prefetchRegistrationQueue(eventId: string) {
  const url = registrationQueueUrl(eventId, DEFAULT_REGISTRATION_QUEUE_QUERY);
  prefetched.set(url, {
    startedAt: Date.now(),
    result: requestRegistrationQueue(url),
  });
}

export function fetchRegistrationQueue(
  eventId: string,
  query: RegistrationQueueQuery,
  skip = 0
): Promise<RegistrationQueueResult> {
  const url = registrationQueueUrl(eventId, query, skip);
  const prefetch = prefetched.get(url);
  // A prefetched response is used at most once and only while fresh.
  prefetched.delete(url);
  if (prefetch && Date.now() - prefetch.startedAt < PREFETCH_MAX_AGE_MS) {
    return prefetch.result;
  }
  return requestRegistrationQueue(url);
}
