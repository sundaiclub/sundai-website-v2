'use client';

import { OrganizerEventForm } from '../../EventForm';

export default function OrganizerEventSettingsPage({
  params,
}: {
  params: { eventId: string };
}) {
  return <OrganizerEventForm eventId={params.eventId} />;
}
