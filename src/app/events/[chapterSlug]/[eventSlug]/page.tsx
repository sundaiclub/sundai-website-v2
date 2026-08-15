import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import {
  AddToCalendarAction,
  EventMaterialsSection,
  EventNarrativeColumn,
  EventRegistrationAction,
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

const DEFAULT_SOCIAL_IMAGE = {
  url: '/images/sundai-social-card.png',
  width: 1200,
  height: 630,
  alt: 'Sundai Club Logo',
};

type EventPageProps = {
  params: { chapterSlug: string; eventSlug: string };
};

export async function generateMetadata({
  params,
}: EventPageProps): Promise<Metadata> {
  const event = await getPublicEventBySlug({
    chapterSlug: params.chapterSlug,
    eventSlug: params.eventSlug,
    viewer: null,
  });

  if (!event) {
    return { title: 'Event Not Found | Sundai Club' };
  }

  const title = `${event.title} | Sundai Club`;
  const description =
    event.description || `Join ${event.chapterName} for ${event.title}.`;
  const image = event.image?.url
    ? { url: event.image.url, alt: event.image.alt || event.title }
    : DEFAULT_SOCIAL_IMAGE;

  return {
    title,
    description,
    openGraph: {
      type: 'website',
      siteName: 'Sundai Club',
      title,
      description,
      images: [image],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [image.url],
    },
  };
}

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
}: EventPageProps) {
  const { userId } = auth();
  const event = await getPublicEventBySlug({
    chapterSlug: params.chapterSlug,
    eventSlug: params.eventSlug,
    viewer: userId ? { clerkId: userId } : null,
    includeApprovedCalendarDetails: true,
  });

  if (!event) notFound();

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
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <ManagementLinkButton
          href={`/chapters/${event.chapterSlug}`}
          variant="ghost"
        >
          <span aria-hidden="true">&larr;</span>
          Back to {event.chapterName}
        </ManagementLinkButton>
        {event.viewerCanManageEvent && (
          <ManagementLinkButton
            href={`/organizer/events/${event.id}`}
            variant="primary"
          >
            Manage
          </ManagementLinkButton>
        )}
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <PublicEventHero
          event={heroEvent}
          chapterActions={
            <>
              <PublicEventStatusBadge status={event.publicStatus} />
              {event.viewerRegistrationStatus && (
                <ViewerRegistrationStatusBadge
                  status={event.viewerRegistrationStatus}
                />
              )}
            </>
          }
          actions={
            <>
              <EventRegistrationAction
                event={event}
                viewerProfile={event.viewerProfile}
              />
              <AddToCalendarAction payload={heroEvent.addToCalendar} />
            </>
          }
        />
        <EventNarrativeColumn event={event} />
      </div>

      <div className="mt-6 grid min-w-0 gap-5">
        <EventProjectCarousel projects={eventProjects} />
        <EventMaterialsSection materials={materialLinks} />
      </div>
    </ManagementPage>
  );
}
