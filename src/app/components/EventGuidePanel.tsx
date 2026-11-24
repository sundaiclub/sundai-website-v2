'use client';

import {
  ManagementEmptyState,
  ManagementSection,
  useManagementClasses,
} from './ManagementSurface';
import { SignInAction } from './SignInAction';

export function EventGuidePanel({
  embedUrl,
  guideUrl,
  signedIn,
  eventTitle,
}: {
  embedUrl: string | null;
  guideUrl: string | null;
  signedIn: boolean;
  eventTitle: string;
}) {
  const classes = useManagementClasses();

  if (!embedUrl || !guideUrl) {
    return (
      <ManagementSection size="large" title="Guide">
        <ManagementEmptyState>
          {signedIn ? (
            <span role="status">
              You are not able to view the material unless you are an approved
              attendee.
            </span>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <span>Sign in to view the guide for this event.</span>
              <SignInAction label="Sign in to view the guide" />
            </div>
          )}
        </ManagementEmptyState>
      </ManagementSection>
    );
  }

  return (
    <ManagementSection
      actions={
        <a
          className={classes.secondaryButton}
          href={guideUrl}
          rel="noopener noreferrer"
          target="_blank"
        >
          Open in new tab
        </a>
      }
      size="large"
      title="Guide"
    >
      <div
        className="relative w-full overflow-hidden rounded-lg bg-black"
        style={{ paddingTop: '56.25%' }}
      >
        <iframe
          allowFullScreen
          className="absolute left-0 top-0 h-full w-full border-0"
          src={embedUrl}
          title={`${eventTitle} guide`}
        />
      </div>
    </ManagementSection>
  );
}
