'use client';

import { SignInButton } from '@clerk/nextjs';
import { useManagementClasses } from './ManagementSurface';

export function SignInAction({ label = 'Sign in' }: { label?: string }) {
  const classes = useManagementClasses();

  return (
    <SignInButton mode="modal">
      <span className={classes.primaryButton}>{label}</span>
    </SignInButton>
  );
}
