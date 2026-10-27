'use client';

import type { ReactNode } from 'react';
import { useParams } from 'next/navigation';
import WorkspaceShell from './WorkspaceShell';

export default function OrganizerEventLayout({ children }: { children: ReactNode }) {
  const params = useParams<{ eventId: string }>();
  return <WorkspaceShell eventId={params.eventId}>{children}</WorkspaceShell>;
}
