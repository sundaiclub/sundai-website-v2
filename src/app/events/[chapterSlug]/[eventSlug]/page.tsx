import { notFound } from 'next/navigation';
import { auth, currentUser } from '@clerk/nextjs/server';
import {
  AddToCalendarAction,
  EventDetailSections,
  EventMaterialsSection,
  EventPitchSection,
  EventProgramHighlights,
  type PublicEventMaterialLink,
} from '@/app/components/EventDetailSections';
import { PublicEventHero } from '@/app/components/EventHeroImage';
import { EventProjectCarousel } from '@/app/components/EventProjectCarousel';
import {
  ManagementLinkButton,
  ManagementPage,
} from '@/app/components/ManagementSurface';
import {
  PublicEventStatusBadge,
  ViewerRegistrationStatusBadge,
} from '@/app/components/PublicEventCard';
import { listVisibleEventMaterials } from '@/lib/eventMaterials';
import { listPublicEventProjects } from '@/lib/publicEventProjects';
import { getPublicEventBySlug } from '@/lib/publicEvents';

type PublicMaterial = {
  id: string;
  kind: 'LINK' | 'FILE';
  visibility: 'PUBLIC' | 'APPROVED_ATTENDEES' | 'ORGANIZERS_ONLY';
  title: string;
  description?: string | null;
  externalUrl?: string | null;
  isAvailable: boolean;
  availableFrom?: string | Date | null;
  availableUntil?: string | Date | null;
};

function currentlyAvailable(material: PublicMaterial, now: Date) {
  if (!material.isAvailable) return false;
  const from = material.availableFrom ? new Date(material.availableFrom) : null;
  const until = material.availableUntil
    ? new Date(material.availableUntil)
    : null;
  if (from && Number.isNaN(from.getTime())) return false;
  if (until && Number.isNaN(until.getTime())) return false;
  if (from && until && until <= from) return false;
  if (from && now < from) return false;
  if (until && now >= until) return false;
  return true;
}

function publicMaterials(
  materials: PublicMaterial[],
  approved: boolean,
  now = new Date()
) {
  return materials.filter(material => {
    if (!currentlyAvailable(material, now)) return false;
    if (material.visibility === 'PUBLIC') return true;
    return material.visibility === 'APPROVED_ATTENDEES' && approved;
  });
}

function approvedAddress(event: {
  approvedDetailsVisible: boolean;
  approvedDetailsJson?: Record<string, unknown> | null;
}) {
  if (!event.approvedDetailsVisible || !event.approvedDetailsJson) return null;

  const address = Object.entries(event.approvedDetailsJson).find(
    ([key, value]) =>
      key.replace(/[^a-z0-9]/gi, '').toLowerCase() === 'address' &&
      typeof value === 'string' &&
      value.trim()
  )?.[1];

  return typeof address === 'string' ? address.trim() : null;
}

export default async function PublicEventDetailPage({
  params,
}: {
  params: { chapterSlug: string; eventSlug: string };
}) {
  const { userId } = auth();
  const event = await getPublicEventBySlug({
    chapterSlug: params.chapterSlug,
    eventSlug: params.eventSlug,
    viewer: userId ? { clerkId: userId } : null,
    includeApprovedCalendarDetails: true,
  });

  if (!event) notFound();

  const viewer = await currentUser();
  const viewerProfile = viewer
    ? {
        name: viewer.fullName,
        email: viewer.primaryEmailAddress?.emailAddress ?? null,
        username: viewer.username,
      }
    : null;
  const [visibleMaterials, eventProjects] = await Promise.all([
    listVisibleEventMaterials({
      eventId: event.id,
      viewer: {
        registrationStatus: event.viewerRegistrationStatus ?? null,
      },
    }) as Promise<PublicMaterial[]>,
    listPublicEventProjects({ eventId: event.id }),
  ]);
  const materials = publicMaterials(
    visibleMaterials.map(material => ({
      id: material.id,
      kind: material.kind,
      visibility: material.visibility,
      title: material.title,
      description: material.description,
      externalUrl: material.externalUrl,
      isAvailable: material.isAvailable,
      availableFrom: material.availableFrom,
      availableUntil: material.availableUntil,
    })),
    event.viewerRegistrationStatus === 'APPROVED'
  );
  const materialLinks = materials.flatMap<PublicEventMaterialLink>(material => {
    const href =
      material.kind === 'FILE'
        ? `/api/events/${event.id}/materials/${material.id}/content`
        : material.externalUrl;
    if (!href || (!href.startsWith('https://') && material.kind === 'LINK')) {
      return [];
    }
    return [
      {
        id: material.id,
        title: material.title,
        description: material.description,
        href,
        kind: material.kind,
      },
    ];
  });
  const privateAddress = approvedAddress(event);
  const heroEvent = privateAddress
    ? {
        ...event,
        publicLocation: privateAddress,
        addToCalendar: {
          ...event.addToCalendar,
          location: privateAddress,
        },
      }
    : event;

  return (
    <ManagementPage maxWidth="max-w-6xl">
      <div className="mb-4">
        <ManagementLinkButton
          href={`/chapters/${event.chapterSlug}`}
          variant="ghost"
        >
          <span aria-hidden="true">&larr;</span>
          Back to {event.chapterName}
        </ManagementLinkButton>
      </div>

      <PublicEventHero
        event={heroEvent}
        actions={
          <>
            <PublicEventStatusBadge status={event.publicStatus} />
            {event.viewerRegistrationStatus && (
              <ViewerRegistrationStatusBadge
                status={event.viewerRegistrationStatus}
              />
            )}
            <AddToCalendarAction payload={heroEvent.addToCalendar} />
            {event.viewerCanManageEvent && (
              <ManagementLinkButton
                href={`/organizer/events/${event.id}`}
                variant="primary"
              >
                Manage
              </ManagementLinkButton>
            )}
          </>
        }
      />

      <div className="mt-6 grid gap-5">
        <EventProgramHighlights
          experts={event.publicExpertText}
          format={event.publicProgramLabel}
          partners={event.publicSponsorText}
        />
        <EventProjectCarousel projects={eventProjects} />
        <EventDetailSections event={event} viewerProfile={viewerProfile} />
        <EventMaterialsSection materials={materialLinks} />
        <EventPitchSection
          eventId={event.pitchSession ? event.id : null}
          phase={event.pitchSession?.phase}
        />
      </div>
    </ManagementPage>
  );
}
