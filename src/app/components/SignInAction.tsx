'use client';

import { useOpenSignIn } from '../hooks/useOpenSignIn';
import { useManagementClasses } from './ManagementSurface';

export function SignInAction({ label = 'Sign in' }: { label?: string }) {
  const classes = useManagementClasses();
  const openSignIn = useOpenSignIn();

  return (
    <button
      className={classes.primaryButton}
      onClick={() => openSignIn()}
      type="button"
    >
      {label}
    </button>
  );
}
