'use client';

import {
  ManagementBadge,
  type ManagementTone,
} from './ManagementSurface';
import type {
  PublicEventStatus,
  RegistrationStatus,
} from '@/types/event-management';

type PublicEventStatusDisplay = {
  label: string;
  tone: ManagementTone;
};

const publicStatusDisplay: Record<PublicEventStatus, PublicEventStatusDisplay> =
  {
    OPEN: { label: 'Open', tone: 'success' },
    CLOSED: { label: 'Closed', tone: 'default' },
    FULL: { label: 'Full', tone: 'warning' },
    WAITLIST_AVAILABLE: { label: 'Waitlist available', tone: 'warning' },
    ENDED: { label: 'Ended', tone: 'default' },
  };

const registrationStatusDisplay: Record<
  RegistrationStatus,
  PublicEventStatusDisplay
> = {
  PENDING: { label: 'Application pending', tone: 'warning' },
  APPROVED: { label: 'Registered', tone: 'success' },
  WAITLISTED: { label: 'Waitlisted', tone: 'warning' },
  DECLINED: { label: 'Application declined', tone: 'danger' },
  BLOCKED: { label: 'Registration unavailable', tone: 'danger' },
  CANCELLED: { label: 'Registration cancelled', tone: 'default' },
};

function getPublicEventStatusDisplay(
  status: PublicEventStatus
): PublicEventStatusDisplay {
  return publicStatusDisplay[status];
}

function getViewerRegistrationStatusDisplay(
  status: RegistrationStatus
): PublicEventStatusDisplay {
  return registrationStatusDisplay[status];
}

export function PublicEventStatusBadge({
  status,
}: {
  status: PublicEventStatus;
}) {
  const display = getPublicEventStatusDisplay(status);

  return <ManagementBadge tone={display.tone}>{display.label}</ManagementBadge>;
}

export function ViewerRegistrationStatusBadge({
  status,
}: {
  status: RegistrationStatus;
}) {
  const display = getViewerRegistrationStatusDisplay(status);

  return <ManagementBadge tone={display.tone}>{display.label}</ManagementBadge>;
}
