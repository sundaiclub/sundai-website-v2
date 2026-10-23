'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { SignInAction } from '@/app/components/SignInAction';
import {
  ManagementPage,
  ManagementSection,
  useManagementClasses,
} from '@/app/components/ManagementSurface';

export default function EventStaffAccessPage({
  params,
}: {
  params: { eventId: string };
}) {
  const { isLoaded, isSignedIn } = useUser();
  const router = useRouter();
  const classes = useManagementClasses();
  const [message, setMessage] = useState('');
  const [checking, setChecking] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let active = true;
    let retry: ReturnType<typeof setTimeout> | undefined;
    setChecking(true);
    setMessage('');
    // The signup webhook links the verified email to the assigned profile.
    // This read checks current access and never creates or restores staff roles.
    fetch(`/api/events/${params.eventId}/workspace`)
      .then(response => {
        if (!active) return;
        if (response.ok) router.replace(`/organizer/events/${params.eventId}`);
        else if (response.status === 401) {
          setMessage(
            'Your account is being prepared. Try again in a few seconds.'
          );
          if (attempt < 5)
            retry = setTimeout(() => setAttempt(value => value + 1), 2000);
        } else if (response.status === 403) {
          setMessage(
            'This account does not have access. Sign in with the email address that received the co-MC email.'
          );
        } else setMessage('The event workspace is unavailable.');
      })
      .catch(() => {
        if (active) setMessage('Unable to open the event. Try again.');
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
      clearTimeout(retry);
    };
  }, [isLoaded, isSignedIn, params.eventId, router, attempt]);

  return (
    <ManagementPage maxWidth="max-w-2xl">
      <ManagementSection title="Open your event workspace">
        <p>
          Sign in or create an account with the email address that received the
          co-MC email. Verify that email address to get access.
        </p>
        {!isLoaded || checking ? (
          <p role="status">{checking ? 'Opening your event…' : 'Loading…'}</p>
        ) : !isSignedIn ? (
          <div className="mt-4">
            <SignInAction label="Sign in or create an account" />
          </div>
        ) : (
          <div className="mt-4">
            <p role="status">{message}</p>
            <button
              type="button"
              className={classes.primaryButton}
              onClick={() => setAttempt(value => value + 1)}
            >
              Try again
            </button>
          </div>
        )}
      </ManagementSection>
    </ManagementPage>
  );
}
