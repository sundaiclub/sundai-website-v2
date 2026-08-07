'use client';

import type { ReactNode } from 'react';
import { AuthStatusAlert } from '../components/AuthStatusAlert';
import { ManagementAlert } from '../components/ManagementSurface';

type AdminAuthGateProps = {
  isAdmin: boolean | undefined;
  isAuthenticated?: boolean;
  loading: boolean | undefined;
  children: ReactNode;
};

export default function AdminAuthGate({
  isAdmin,
  isAuthenticated = true,
  loading,
  children,
}: AdminAuthGateProps) {
  if (loading) {
    return <ManagementAlert>Loading...</ManagementAlert>;
  }

  if (!isAuthenticated) {
    return <AuthStatusAlert status="unauthenticated" />;
  }

  if (!isAdmin) {
    return <AuthStatusAlert status="forbidden" />;
  }

  return <>{children}</>;
}
