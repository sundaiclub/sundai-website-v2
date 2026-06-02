'use client';

import { ManagementAlert } from './ManagementSurface';

export type AuthStatus = 'unauthenticated' | 'forbidden' | 'not-found';

export function authStatusFromResponse(
  response: Pick<Response, 'status'>
): AuthStatus | null {
  if (response.status === 401) return 'unauthenticated';
  if (response.status === 403) return 'forbidden';
  if (response.status === 404) return 'not-found';
  return null;
}

export function authStatusMessage(status: AuthStatus) {
  if (status === 'unauthenticated') {
    return 'Please sign in to view this page.';
  }

  if (status === 'not-found') {
    return 'This page could not be found.';
  }

  return 'You do not have permission to view this page.';
}

export function AuthStatusAlert({ status }: { status: AuthStatus }) {
  return (
    <ManagementAlert tone="danger">{authStatusMessage(status)}</ManagementAlert>
  );
}
