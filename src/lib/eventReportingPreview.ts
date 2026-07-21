import type {
  EventProjectCardStatus,
  EventRegistrationStatus,
  Prisma,
  PrismaClient,
} from '@prisma/client';
import prisma from '@/lib/prisma';

type EventReportingPrisma = Pick<
  PrismaClient,
  'eventRegistration' | 'eventProject' | 'pitchProject' | 'eventMaterial' | 'eventCommunication'
>;

const REGISTRATION_FUNNEL_STATUSES = [
  'PENDING',
  'APPROVED',
  'WAITLISTED',
  'DECLINED',
  'CANCELLED',
] as const satisfies readonly EventRegistrationStatus[];

const PROJECT_CARD_STATUSES = [
  'DRAFT',
  'NEEDS_INFO',
  'SUBMITTED',
  'APPROVED',
] as const satisfies readonly EventProjectCardStatus[];

export type ReportingUnavailableMetric =
  | 'checkIn'
  | 'attendance'
  | 'noShows';

export interface ReportingUnavailableDescriptor {
  metric: ReportingUnavailableMetric;
  label: string;
  reason: string;
}

export interface EventReportingPreview {
  eventId: string;
  registrations: Record<
    Lowercase<(typeof REGISTRATION_FUNNEL_STATUSES)[number]>,
    number
  >;
  projects: {
    total: number;
    cardStatus: Record<
      Lowercase<(typeof PROJECT_CARD_STATUSES)[number]>,
      number
    >;
    queued: number;
    pitched: number;
    highlighted: number;
  };
  materials: {
    total: number;
    links: number;
    files: number;
    available: number;
  };
  communications: {
    completed: number;
    recipients: number;
    sent: number;
    failed: number;
  };
  unavailable: ReportingUnavailableDescriptor[];
}

export const REPORTING_UNAVAILABLE_METRICS: ReportingUnavailableDescriptor[] = [
  {
    metric: 'checkIn',
    label: 'Check-in',
    reason: 'Event-native check-in is deferred and unavailable.',
  },
  {
    metric: 'attendance',
    label: 'Attendance',
    reason: 'Event-native attendance is deferred and unavailable.',
  },
  {
    metric: 'noShows',
    label: 'No-shows',
    reason: 'Event-native no-show reporting is deferred and unavailable.',
  },
];

export async function getEventReportingPreview(
  eventId: string,
  isSiteAdmin: boolean,
  db: EventReportingPrisma = prisma
): Promise<EventReportingPreview> {
  const projectVisibilityWhere = !isSiteAdmin
    ? { project: { launchLead: { userBans: { none: { revokedAt: null } } } } }
    : {};
  const eventProjectWhere = { eventId, ...projectVisibilityWhere };
  const pitchProjectWhere = {
    pitchSession: { eventId },
    ...projectVisibilityWhere,
  };
  const completedCommunicationWhere: Prisma.EventCommunicationWhereInput = {
    eventId,
    status: { in: ['SENT', 'PARTIAL', 'FAILED'] },
  };

  const [
    registrationGroups,
    cardStatusGroups,
    projectTotal,
    queuedProjects,
    pitchedProjects,
    highlightedProjects,
    materialGroups,
    communicationTotals,
  ] = await Promise.all([
    db.eventRegistration.groupBy({
      by: ['status'],
      where: {
        eventId,
        status: { in: [...REGISTRATION_FUNNEL_STATUSES] },
        ...(!isSiteAdmin && {
          hacker: { userBans: { none: { revokedAt: null } } },
        }),
      },
      _count: { _all: true },
    }),
    db.eventProject.groupBy({
      by: ['cardStatus'],
      where: eventProjectWhere,
      _count: { _all: true },
    }),
    db.eventProject.count({ where: eventProjectWhere }),
    db.pitchProject.count({
      where: { ...pitchProjectWhere, status: 'QUEUED' },
    }),
    db.pitchProject.count({
      where: { ...pitchProjectWhere, completedAt: { not: null } },
    }),
    db.pitchProject.count({
      where: { ...pitchProjectWhere, isTopProject: true },
    }),
    db.eventMaterial.groupBy({
      by: ['kind', 'isAvailable'],
      where: { eventId },
      _count: { _all: true },
    }),
    db.eventCommunication.aggregate({
      where: completedCommunicationWhere,
      _count: true,
      _sum: {
        recipientCount: true,
        sentCount: true,
        failedCount: true,
      },
    }),
  ]);

  const registrations = Object.fromEntries(
    REGISTRATION_FUNNEL_STATUSES.map(status => [
      status.toLowerCase(),
      registrationGroups.find(group => group.status === status)?._count._all ??
        0,
    ])
  ) as EventReportingPreview['registrations'];

  const cardStatus = Object.fromEntries(
    PROJECT_CARD_STATUSES.map(status => [
      status.toLowerCase(),
      cardStatusGroups.find(group => group.cardStatus === status)?._count._all ??
        0,
    ])
  ) as EventReportingPreview['projects']['cardStatus'];

  const materialCount = (kind: 'LINK' | 'FILE') =>
    materialGroups
      .filter(group => group.kind === kind)
      .reduce((total, group) => total + group._count._all, 0);

  return {
    eventId,
    registrations,
    projects: {
      total: projectTotal,
      cardStatus,
      queued: queuedProjects,
      pitched: pitchedProjects,
      highlighted: highlightedProjects,
    },
    materials: {
      total: materialGroups.reduce(
        (total, group) => total + group._count._all,
        0
      ),
      links: materialCount('LINK'),
      files: materialCount('FILE'),
      available: materialGroups
        .filter(group => group.isAvailable)
        .reduce((total, group) => total + group._count._all, 0),
    },
    communications: {
      completed: communicationTotals._count,
      recipients: communicationTotals._sum.recipientCount ?? 0,
      sent: communicationTotals._sum.sentCount ?? 0,
      failed: communicationTotals._sum.failedCount ?? 0,
    },
    unavailable: REPORTING_UNAVAILABLE_METRICS.map(descriptor => ({
      ...descriptor,
    })),
  };
}
