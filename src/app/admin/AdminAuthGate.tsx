'use client';

import type { ReactNode } from 'react';
import { ManagementAlert } from '../components/ManagementSurface';

type AdminAuthGateProps = {
  isAdmin: boolean | undefined;
  loading: boolean | undefined;
  children: ReactNode;
};

export default function AdminAuthGate({
  isAdmin,
  loading,
  children,
}: AdminAuthGateProps) {
  if (loading) {
    return <ManagementAlert>Loading...</ManagementAlert>;
  }

  if (!isAdmin) {
    return (
      <ManagementAlert tone="danger">
        You do not have permission to view this page.
      </ManagementAlert>
    );
  }

  return <>{children}</>;
}
