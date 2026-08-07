import EventCommunicationsPanel from './EventCommunicationsPanel';

export default function OrganizerEventCommunicationsPage({
  params,
}: {
  params: { eventId: string };
}) {
  return <EventCommunicationsPanel eventId={params.eventId} />;
}
