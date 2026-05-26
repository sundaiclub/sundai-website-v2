"use client";

import type { ReactNode } from "react";

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
    return <div className="text-center">Loading...</div>;
  }

  if (!isAdmin) {
    return (
      <div className="text-center text-red-500">
        You do not have permission to view this page.
      </div>
    );
  }

  return <>{children}</>;
}
