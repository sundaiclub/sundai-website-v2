import { notFound } from 'next/navigation';
import { auth, currentUser } from '@clerk/nextjs/server';
import {
  AddToCalendarAction,
  EventDetailSections,
} from '@/app/components/EventDetailSections';
import { EventHeroImage } from '@/app/components/EventHeroImage';
import {
  ManagementHeader,
  ManagementLinkButton,
  ManagementPage,
  ManagementSection,
} from '@/app/components/ManagementSurface';
import {
  PublicEventStatusBadge,
  ViewerRegistrationStatusBadge,
} from '@/app/components/PublicEventCard';
import { listVisibleEventMaterials } from '@/lib/eventMaterials';
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
  const visibleMaterials = (await listVisibleEventMaterials({
    eventId: event.id,
    viewer: {
      registrationStatus: event.viewerRegistrationStatus ?? null,
    },
  })) as PublicMaterial[];
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

  return (
    <ManagementPage maxWidth="max-w-4xl">
      <div className="mb-4">
        <ManagementLinkButton
          href={`/chapters/${event.chapterSlug}`}
          variant="ghost"
        >
          <span aria-hidden="true">&larr;</span>
          Back to {event.chapterName}
        </ManagementLinkButton>
      </div>

      <EventHeroImage image={event.image} title={event.title} />

      <ManagementHeader
        eyebrow={event.chapterName}
        title={event.title}
        description={event.description}
        actions={
          <>
            {event.viewerCanManageEvent && (
              <ManagementLinkButton
                href={`/organizer/events/${event.id}`}
                variant="primary"
              >
                Manage
              </ManagementLinkButton>
            )}
            <PublicEventStatusBadge status={event.publicStatus} />
            {event.viewerRegistrationStatus && (
              <ViewerRegistrationStatusBadge
                status={event.viewerRegistrationStatus}
              />
            )}
            <AddToCalendarAction payload={event.addToCalendar} />
          </>
        }
      />

      {(event.publicProgramLabel ||
        event.publicSponsorText ||
        event.publicExpertText) && (
        <ManagementSection title="Program">
          <div className="grid gap-4 text-sm leading-6">
            {event.publicProgramLabel && (
              <p>
                <span className="font-semibold">Format: </span>
                {event.publicProgramLabel}
              </p>
            )}
            {event.publicSponsorText && <p>{event.publicSponsorText}</p>}
            {event.publicExpertText && <p>{event.publicExpertText}</p>}
          </div>
        </ManagementSection>
      )}

      <div className="mt-5">
        <EventDetailSections event={event} viewerProfile={viewerProfile} />
      </div>

      {event.pitchSession && (
        <div className="mt-5">
          <ManagementSection
            title="Pitch"
            actions={
              <ManagementLinkButton
                href={`/pitch/${event.id}`}
                variant="primary"
              >
                Open pitch event
              </ManagementLinkButton>
            }
          >
            <p className="text-sm leading-6">
              Pitching is currently {event.pitchSession.phase.toLowerCase()}.
              Open the pitch event to add an eligible project, follow the queue,
              and participate in voting.
            </p>
          </ManagementSection>
        </div>
      )}

      {materials.length > 0 && (
        <div className="mt-5">
          <ManagementSection title="Event materials">
            <ul className="grid gap-3">
              {materials.map(material => {
                const href =
                  material.kind === 'FILE'
                    ? `/api/events/${event.id}/materials/${material.id}/content`
                    : material.externalUrl;
                if (
                  !href ||
                  (!href.startsWith('https://') && material.kind === 'LINK')
                ) {
                  return null;
                }

                return (
                  <li key={material.id}>
                    <a
                      className="font-semibold underline underline-offset-4 hover:no-underline"
                      href={href}
                      {...(material.kind === 'LINK'
                        ? { rel: 'noopener noreferrer' }
                        : {})}
                    >
                      {material.title}
                    </a>
                    {material.description && (
                      <p className="mt-1 text-sm text-gray-600">
                        {material.description}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          </ManagementSection>
        </div>
      )}
    </ManagementPage>
  );
}
