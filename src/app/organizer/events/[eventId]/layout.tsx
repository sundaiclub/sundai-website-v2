import type { ReactNode } from 'react';
import WorkspaceShell from './WorkspaceShell';

export default async function OrganizerEventLayout(props: {
  children: ReactNode;
  params: Promise<{ eventId: string }>;
}) {
  const params = await props.params;

  const { children } = props;

  return <WorkspaceShell eventId={params.eventId}>{children}</WorkspaceShell>;
}
