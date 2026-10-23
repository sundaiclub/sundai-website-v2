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

export default function StaffInvitationPage({
  params,
}: {
  params: { invitationId: string };
}) {
  const { isLoaded, isSignedIn } = useUser();
  const router = useRouter();
  const classes = useManagementClasses();
  const [message, setMessage] = useState('');
  const [accepting, setAccepting] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let active = true;
    let retry: ReturnType<typeof setTimeout> | undefined;
    setAccepting(true);
    setMessage('');
    fetch(`/api/events/staff-invitations/${params.invitationId}/accept`, {
      method: 'POST',
    })
      .then(async response => {
        const payload = await response.json();
        if (!active) return;
        if (response.ok) router.replace(payload.workspaceUrl);
        else {
          setMessage(payload.message ?? 'Unable to accept this invite.');
          if (response.status === 409 && attempt < 5) {
            retry = setTimeout(() => setAttempt(value => value + 1), 2000);
          }
        }
      })
      .catch(() => {
        if (active) setMessage('Unable to accept this invite. Try again.');
      })
      .finally(() => {
        if (active) setAccepting(false);
      });
    return () => {
      active = false;
      clearTimeout(retry);
    };
  }, [isLoaded, isSignedIn, params.invitationId, router, attempt]);

  return (
    <ManagementPage maxWidth="max-w-2xl">
      <ManagementSection title="Co-MC invitation">
        <p>
          Sign in or create an account to accept your co-MC invite. Use the
          email address that received the invite and verify it on your account.
        </p>
        {!isLoaded || accepting ? (
          <p role="status">
            {accepting ? 'Accepting your invite…' : 'Loading…'}
          </p>
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
