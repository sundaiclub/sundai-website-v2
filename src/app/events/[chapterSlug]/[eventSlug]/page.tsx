import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import {
  AddToCalendarAction,
  EventMaterialsSection,
  EventNarrativeColumn,
  EventPitchSection,
  EventRegistrationAction,
  type PublicEventMaterialLink,
} from '@/app/components/EventDetailSections';
import { PublicEventHero } from '@/app/components/EventHeroImage';
import { EventProjectCarousel } from '@/app/components/EventProjectCarousel';
import PitchEventPage from '@/app/components/PitchEventPage';
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
import { getPublicEventSocialMetadata } from '@/lib/eventSocialMetadata';
import { DEFAULT_SOCIAL_IMAGE_URL, publicUrl } from '@/lib/siteUrl';

const DEFAULT_SOCIAL_IMAGE = {
  url: DEFAULT_SOCIAL_IMAGE_URL,
  width: 1200,
  height: 630,
  type: 'image/png',
  alt: 'Sundai Club Logo',
};

type EventPageProps = {
  params: { chapterSlug: string; eventSlug: string };
  searchParams?: { tab?: string | string[] };
};

type EventTab = 'info' | 'projects' | 'pitch';

const eventTabs: Array<{ id: EventTab; label: string }> = [
  { id: 'info', label: 'Info' },
  { id: 'projects', label: 'Projects' },
  { id: 'pitch', label: 'Pitch' },
];

export async function generateMetadata({
  params,
}: EventPageProps): Promise<Metadata> {
  const event = await getPublicEventSocialMetadata({
    chapterSlug: params.chapterSlug,
    eventSlug: params.eventSlug,
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
  const pageUrl = publicUrl(
    `/events/${encodeURIComponent(params.chapterSlug)}/${encodeURIComponent(params.eventSlug)}`
  );

  return {
    title,
    description,
    alternates: { canonical: pageUrl },
    openGraph: {
      type: 'website',
      url: pageUrl,
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
  searchParams,
}: EventPageProps) {
  const { userId } = auth();
  const event = await getPublicEventBySlug({
    chapterSlug: params.chapterSlug,
    eventSlug: params.eventSlug,
    viewer: userId ? { clerkId: userId } : null,
    includeApprovedCalendarDetails: true,
  });

  if (!event) notFound();

  const requestedTab = Array.isArray(searchParams?.tab)
    ? searchParams?.tab[0]
    : searchParams?.tab;
  const activeTab: EventTab = eventTabs.some(tab => tab.id === requestedTab)
    ? (requestedTab as EventTab)
    : 'info';
  const eventPath = `/events/${encodeURIComponent(event.chapterSlug)}/${encodeURIComponent(event.slug)}`;

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

      <nav aria-label="Event sections" className="mb-5 overflow-x-auto">
        <ul className="flex min-w-max gap-1 border-b" role="list">
          {eventTabs.map(tab => {
            const href =
              tab.id === 'info' ? eventPath : `${eventPath}?tab=${tab.id}`;
            const isCurrent = activeTab === tab.id;
            return (
              <li key={tab.id}>
                <Link
                  aria-current={isCurrent ? 'page' : undefined}
                  className={`block border-b-2 px-4 py-3 text-sm font-semibold outline-none focus-visible:ring-2 ${
                    isCurrent
                      ? 'border-current'
                      : 'border-transparent hover:border-current'
                  }`}
                  href={href}
                >
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {activeTab === 'info' && (
        <>
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
            <EventMaterialsSection materials={materialLinks} />
          </div>
        </>
      )}

      {activeTab === 'projects' && (
        <div className="grid min-w-0 gap-5">
          <EventPitchSection
            event={event}
            returnTo={`${eventPath}?tab=projects`}
          />
          <EventProjectCarousel projects={eventProjects} />
        </div>
      )}

      {activeTab === 'pitch' && <PitchEventPage eventId={event.id} />}
    </ManagementPage>
  );
}
