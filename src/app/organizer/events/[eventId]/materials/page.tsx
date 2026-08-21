import EventMaterialsPanel from './EventMaterialsPanel';

export default async function OrganizerEventMaterialsPage(props: {
  params: Promise<{ eventId: string }>;
}) {
  const params = await props.params;
  return <EventMaterialsPanel eventId={params.eventId} />;
}
