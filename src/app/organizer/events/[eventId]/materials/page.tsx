import EventMaterialsPanel from './EventMaterialsPanel';

export default function OrganizerEventMaterialsPage({
  params,
}: {
  params: { eventId: string };
}) {
  return <EventMaterialsPanel eventId={params.eventId} />;
}
