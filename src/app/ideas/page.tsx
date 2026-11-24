import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { EventPickerPage } from '@/app/components/EventPickerPage';
import { listTodaysPublicEvents } from '@/lib/eventIdeas';
import { eventTabPath } from '@/lib/eventPicker';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Ideas | Sundai Club',
  description: "Pick one of today's events to share and browse project ideas.",
};

export default async function IdeasLandingPage() {
  await auth.protect();
  const events = await listTodaysPublicEvents();
  // With only one event today there is nothing to pick.
  if (events.length === 1) redirect(eventTabPath(events[0], 'ideas'));

  return (
    <EventPickerPage
      description="Pick today's event to share what you want to build and see everyone else's ideas."
      emptyMessage="There are no public events happening today."
      events={events}
      tab="ideas"
      title="Ideas"
    />
  );
}
