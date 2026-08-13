'use client';
import {
  ManagementLinkButton,
  ManagementSection,
  useManagementClasses,
} from '../../../components/ManagementSurface';
import {
  useEventWorkspace,
  type EventWorkspacePayload,
} from './WorkspaceShell';
import EventStaffPanel from './staff/EventStaffPanel';

function words(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatSchedule(startTime: string, endTime: string, timezone: string) {
  const start = new Date(startTime);
  const end = new Date(endTime);
  if (Number.isNaN(start.valueOf()) || Number.isNaN(end.valueOf())) {
    return 'Schedule unavailable';
  }

  return `${start.toLocaleTimeString(undefined, {
    timeStyle: 'short',
    timeZone: timezone,
  })} – ${end.toLocaleTimeString(undefined, {
    timeStyle: 'short',
    timeZone: timezone,
  })}`;
}

function Counts({ workspace }: { workspace: EventWorkspacePayload }) {
  const classes = useManagementClasses();
  const { counts } = workspace;
  const registrationTotal = Object.values(counts.registrations).reduce(
    (total, count) => total + count,
    0
  );

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      <div className={`${classes.subtlePanel} p-4`}>
        <h3 className="font-bold">RSVPs</h3>
        {registrationTotal === 0 ? (
          <p className={`mt-2 text-sm ${classes.mutedText}`}>
            No registrations yet.
          </p>
        ) : (
          <ul className={`mt-2 space-y-1 text-sm ${classes.mutedText}`}>
            {Object.entries(counts.registrations).map(([status, count]) => (
              <li key={status}>
                {count} {status}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={`${classes.subtlePanel} p-4`}>
        <h3 className="font-bold">Projects</h3>
        {counts.projects.total === 0 ? (
          <p className={`mt-2 text-sm ${classes.mutedText}`}>
            No projects are linked to this event.
          </p>
        ) : (
          <div className={`mt-2 space-y-1 text-sm ${classes.mutedText}`}>
            <p>{counts.projects.total} total projects</p>
            <p>{counts.projects.submittedCards} submitted cards</p>
          </div>
        )}
      </div>

      <div className={`${classes.subtlePanel} p-4`}>
        <h3 className="font-bold">Pitch</h3>
        <div className={`mt-2 space-y-1 text-sm ${classes.mutedText}`}>
          <p>{counts.pitch.queued} queued</p>
          <p>{counts.pitch.pitched} pitched</p>
          <p>{counts.pitch.highlighted} highlighted</p>
        </div>
      </div>

      <div className={`${classes.subtlePanel} p-4`}>
        <h3 className="font-bold">Materials</h3>
        <p className={`mt-2 text-sm ${classes.mutedText}`}>
          {counts.materials === 0
            ? 'No materials have been added.'
            : `${counts.materials} materials`}
        </p>
      </div>

      <div className={`${classes.subtlePanel} p-4`}>
        <h3 className="font-bold">Communications</h3>
        <p className={`mt-2 text-sm ${classes.mutedText}`}>
          {counts.communications === 0
            ? 'No communications have been created.'
            : `${counts.communications} communications`}
        </p>
      </div>
    </div>
  );
}

export default function OrganizerEventOverviewPage({
  params,
}: {
  params: { eventId: string };
}) {
  const classes = useManagementClasses();
  const workspace = useEventWorkspace();

  const { event, capabilities } = workspace;

  return (
    <div className="space-y-5">
      <ManagementSection
        title="Overview"
        actions={
          <div className="flex flex-wrap gap-2">
            {capabilities.managePitch && event.status !== 'DRAFT' && (
              <ManagementLinkButton
                href={`/pitch/${params.eventId}`}
                variant="secondary"
              >
                Open pitch controller
              </ManagementLinkButton>
            )}
            {capabilities.administerEvent && (
              <ManagementLinkButton
                href={`/organizer/events/${params.eventId}/settings`}
                variant="primary"
              >
                Edit event details
              </ManagementLinkButton>
            )}
          </div>
        }
      >
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className={classes.subtlePanel + ' p-4'}>
            <dt className={`text-sm ${classes.mutedText}`}>Schedule</dt>
            <dd className="mt-1 font-semibold">
              {formatSchedule(event.startTime, event.endTime, event.timezone)}
            </dd>
          </div>
          <div className={classes.subtlePanel + ' p-4'}>
            <dt className={`text-sm ${classes.mutedText}`}>Capacity</dt>
            <dd className="mt-1 font-semibold">
              {event.capacity ?? 'Unlimited'}
            </dd>
          </div>
          <div className={classes.subtlePanel + ' p-4'}>
            <dt className={`text-sm ${classes.mutedText}`}>Application mode</dt>
            <dd className="mt-1 font-semibold">
              {words(event.applicationMode)}
            </dd>
          </div>
          <div className={classes.subtlePanel + ' p-4'}>
            <dt className={`text-sm ${classes.mutedText}`}>Applications</dt>
            <dd className="mt-1 font-semibold">
              {event.applicationsOpen
                ? 'Applications open'
                : 'Applications closed'}
            </dd>
          </div>
          <div className={classes.subtlePanel + ' p-4'}>
            <dt className={`text-sm ${classes.mutedText}`}>Waitlist</dt>
            <dd className="mt-1 font-semibold">
              Auto-promote {event.autoPromoteWaitlist ? 'on' : 'off'}
            </dd>
          </div>
          <div className={classes.subtlePanel + ' p-4'}>
            <dt className={`text-sm ${classes.mutedText}`}>
              Approved-only details
            </dt>
            <dd className="mt-1 font-semibold">
              {event.hasApprovedOnlyDetails ? 'Configured' : 'Not configured'}
            </dd>
          </div>
        </dl>
        {capabilities.administerEvent && (
          <div
            className="mt-4 flex flex-wrap gap-2"
            aria-label="Event lifecycle actions"
          >
            <button className={classes.secondaryButton} type="button">
              {event.status === 'PUBLISHED' ? 'Unpublish' : 'Publish'}
            </button>
            <button className={classes.secondaryButton} type="button">
              Cancel event
            </button>
          </div>
        )}
      </ManagementSection>

      <EventStaffPanel
        canAssignStaff={capabilities.assignStaff}
        eventId={params.eventId}
        initialStaff={workspace.staff}
      />

      <ManagementSection title="Current activity">
        <Counts workspace={workspace} />
      </ManagementSection>
    </div>
  );
}
