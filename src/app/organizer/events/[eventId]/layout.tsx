import type { ReactNode } from 'react';
import WorkspaceShell from './WorkspaceShell';

export default function OrganizerEventLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: { eventId: string };
}) {
  return <WorkspaceShell eventId={params.eventId}>{children}</WorkspaceShell>;
}
