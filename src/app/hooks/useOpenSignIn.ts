'use client';

import { useClerk } from '@clerk/nextjs';
import { useCallback } from 'react';

function currentPageUrl() {
  const { pathname, search, hash } = window.location;
  return `${pathname}${search}${hash}`;
}

// Opens the Clerk modal and returns visitors to this page afterwards, including
// first-time visitors whose account is created during the flow.
export function useOpenSignIn() {
  const { openSignIn } = useClerk();

  return useCallback(
    (redirectUrl?: string) => {
      const target = redirectUrl ?? currentPageUrl();
      openSignIn({
        forceRedirectUrl: target,
        signUpForceRedirectUrl: target,
      });
    },
    [openSignIn]
  );
}
