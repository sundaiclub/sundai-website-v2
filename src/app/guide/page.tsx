import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { EventPickerPage } from '@/app/components/EventPickerPage';
import { getCurrentHacker } from '@/lib/eventManagementApi';
import { listViewerGuideEvents } from '@/lib/eventGuide';
import { eventTabPath } from '@/lib/eventPicker';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Guide | Sundai Club',
  description: 'Open the guide for an event you are attending.',
};

export default async function GuideLandingPage() {
  await auth.protect();
  const hacker = await getCurrentHacker();
  const events = hacker ? await listViewerGuideEvents(hacker) : [];
  // With only one guide there is nothing to pick.
  if (events.length === 1) redirect(eventTabPath(events[0], 'guide'));

  return (
    <EventPickerPage
      description="Pick an event to open its guide."
      emptyMessage="Event guides show up here once you are approved for an event."
      events={events}
      tab="guide"
      title="Guide"
    />
  );
}
