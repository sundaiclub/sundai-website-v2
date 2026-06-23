import type {
  EventApplicationMode,
  EventStaffRole,
} from '@/types/event-management';

const APPLICATION_MODES = ['REQUIRES_APPROVAL', 'OPEN_RSVP'] as const;
const EVENT_STAFF_ROLES = ['MC', 'CO_MC'] as const;

export function slugifyEventValue(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'event'
  );
}

export function parseEventApplicationMode(
  value: unknown,
  defaultValue?: EventApplicationMode
): EventApplicationMode | undefined | null {
  if (value === undefined) return defaultValue;
  if (
    typeof value === 'string' &&
    APPLICATION_MODES.includes(value as EventApplicationMode)
  ) {
    return value as EventApplicationMode;
  }

  return null;
}

export function parseApplicationsOpen(
  value: unknown,
  defaultValue?: boolean
): boolean | undefined | null {
  if (value === undefined) return defaultValue;
  return typeof value === 'boolean' ? value : null;
}

export type ParsedEventStaffAssignment = {
  hackerId: string;
  role: EventStaffRole;
};

export function parseEventStaffAssignments(
  value: unknown
): ParsedEventStaffAssignment[] | null {
  if (!Array.isArray(value)) return null;

  const assignments: ParsedEventStaffAssignment[] = [];
  for (const assignment of value) {
    if (!assignment || typeof assignment !== 'object') return null;

    const { hackerId, role } = assignment as {
      hackerId?: unknown;
      role?: unknown;
    };
    const normalizedHackerId =
      typeof hackerId === 'string' ? hackerId.trim() : '';
    if (
      normalizedHackerId.length === 0 ||
      typeof role !== 'string' ||
      !EVENT_STAFF_ROLES.includes(role as EventStaffRole)
    ) {
      return null;
    }

    assignments.push({
      hackerId: normalizedHackerId,
      role: role as EventStaffRole,
    });
  }

  return assignments;
}

export type ParsedOptionalDate =
  | { date: Date | null; error?: never }
  | { date?: never; error: string };

export function parseOptionalDateInput(
  value: unknown,
  field: string
): ParsedOptionalDate {
  if (value === undefined || value === null || value === '') {
    return { date: null };
  }

  if (typeof value !== 'string' && !(value instanceof Date)) {
    return { error: `${field} must be a valid date` };
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return { error: `${field} must be a valid date` };
  }

  return { date };
}
