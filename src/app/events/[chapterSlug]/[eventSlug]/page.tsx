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
    </ManagementPage>
  );
}
