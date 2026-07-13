import { notFound } from 'next/navigation';
import { auth, currentUser } from '@clerk/nextjs/server';
import { EventDetailSections } from '@/app/components/EventDetailSections';
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
  const materials = publicMaterials(
    (event as typeof event & { materials?: PublicMaterial[] }).materials ?? [],
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

      <ManagementHeader
        eyebrow={event.chapterName}
        title={event.title}
        description={event.description}
        actions={
          <>
            {event.viewerCanManageRegistrations && (
              <ManagementLinkButton
                href={`/organizer/events/${event.id}/registrations`}
                variant="primary"
              >
                Manage attendees
              </ManagementLinkButton>
            )}
            {event.viewerCanEditEvent && (
              <ManagementLinkButton
                href={`/organizer/events/${event.id}/settings`}
              >
                Edit event
              </ManagementLinkButton>
            )}
            <PublicEventStatusBadge status={event.publicStatus} />
            {event.viewerRegistrationStatus && (
              <ViewerRegistrationStatusBadge
                status={event.viewerRegistrationStatus}
              />
            )}
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
