import EventCommunicationsPanel from './EventCommunicationsPanel';

export default async function OrganizerEventCommunicationsPage(props: {
  params: Promise<{ eventId: string }>;
}) {
  const params = await props.params;
  return <EventCommunicationsPanel eventId={params.eventId} />;
}
