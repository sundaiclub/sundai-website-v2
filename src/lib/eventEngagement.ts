import prisma from '@/lib/prisma';
import type {
  ChapterEngagement,
  EventEngagementReport,
  EventEngagementRow,
} from '@/types/event-engagement';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
// Smaller hacks give noisy rates, so they are left off the report.
export const MIN_RSVPS = 30;

export type EventEngagementQueryRow = {
  eventId: string;
  title: string;
  startTime: Date;
  chapterId: string;
  chapterName: string;
  rsvps: number;
  projects: number;
  presented: number;
  rsvpBuilders: number;
};

// One row per started, non-draft event with at least one active RSVP.
// Projects are those in the event's pitch queue or with a published event
// card. A builder is the launch lead or a participant on one of those
// projects, and only builders who RSVP'd to the event are counted.
export function loadEventEngagementRows(now: Date, db = prisma) {
  return db.$queryRaw<EventEngagementQueryRow[]>`
    WITH rsvp AS (
      SELECT "eventId", "hackerId" FROM "EventRegistration"
      WHERE status IN ('APPROVED', 'PENDING', 'WAITLISTED')
    ),
    event_projects AS (
      SELECT ps."eventId", pp."projectId", pp.status = 'DONE' AS presented
      FROM "PitchSession" ps
      JOIN "PitchProject" pp ON pp."pitchSessionId" = ps.id
      WHERE ps."eventId" IS NOT NULL
      UNION ALL
      SELECT "eventId", "projectId", false FROM "EventProject"
      WHERE "cardStatus" = 'APPROVED'
    ),
    projects AS (
      SELECT "eventId", "projectId", bool_or(presented) AS presented
      FROM event_projects GROUP BY 1, 2
    ),
    builders AS (
      SELECT pr."eventId", p."launchLeadId" AS "hackerId"
      FROM projects pr JOIN "Project" p ON p.id = pr."projectId"
      UNION
      SELECT pr."eventId", ptp."hackerId"
      FROM projects pr
      JOIN "ProjectToParticipant" ptp ON ptp."projectId" = pr."projectId"
    ),
    rsvp_counts AS (
      SELECT "eventId", COUNT(*)::int AS rsvps FROM rsvp GROUP BY 1
    ),
    project_counts AS (
      SELECT "eventId", COUNT(*)::int AS projects,
        COUNT(*) FILTER (WHERE presented)::int AS presented
      FROM projects GROUP BY 1
    ),
    builder_counts AS (
      SELECT b."eventId", COUNT(*)::int AS "rsvpBuilders"
      FROM builders b
      JOIN rsvp r ON r."eventId" = b."eventId" AND r."hackerId" = b."hackerId"
      GROUP BY 1
    )
    SELECT e.id AS "eventId", e.title, e."startTime",
      c.id AS "chapterId", c.name AS "chapterName", rc.rsvps,
      COALESCE(pc.projects, 0) AS projects,
      COALESCE(pc.presented, 0) AS presented,
      COALESCE(bc."rsvpBuilders", 0) AS "rsvpBuilders"
    FROM "Event" e
    JOIN "Chapter" c ON c.id = e."chapterId"
    JOIN rsvp_counts rc ON rc."eventId" = e.id
    LEFT JOIN project_counts pc ON pc."eventId" = e.id
    LEFT JOIN builder_counts bc ON bc."eventId" = e.id
    WHERE e.status <> 'DRAFT' AND e."startTime" <= ${now}`;
}

function rate(builders: number, rsvps: number) {
  return rsvps > 0 ? builders / rsvps : null;
}

function compareEvents(a: EventEngagementRow, b: EventEngagementRow) {
  if (a.builtRate === null || b.builtRate === null) {
    if (a.builtRate !== b.builtRate) return a.builtRate === null ? 1 : -1;
  } else if (a.builtRate !== b.builtRate) {
    return b.builtRate - a.builtRate;
  }
  if (a.rsvpBuilders !== b.rsvpBuilders) return b.rsvpBuilders - a.rsvpBuilders;
  return b.startTime.localeCompare(a.startTime);
}

// Group events with at least MIN_RSVPS RSVPs by chapter, rank each chapter's events by the share of RSVPs
// who built a project, and flag events that started in the past seven days.
export function buildEventEngagementReport(
  rows: EventEngagementQueryRow[],
  now: Date
): EventEngagementReport {
  const lastWeekStart = new Date(now.getTime() - WEEK_MS);
  const chapters = new Map<string, ChapterEngagement>();

  for (const row of rows) {
    if (row.rsvps < MIN_RSVPS) continue;
    let chapter = chapters.get(row.chapterId);
    if (!chapter) {
      chapter = {
        chapterId: row.chapterId,
        chapterName: row.chapterName,
        rsvps: 0,
        rsvpBuilders: 0,
        builtRate: null,
        rankedEvents: 0,
        events: [],
      };
      chapters.set(row.chapterId, chapter);
    }
    const hasProjects = row.projects > 0;
    chapter.events.push({
      eventId: row.eventId,
      title: row.title,
      startTime: row.startTime.toISOString(),
      rsvps: row.rsvps,
      projects: row.projects,
      presented: row.presented,
      rsvpBuilders: row.rsvpBuilders,
      builtRate: hasProjects ? rate(row.rsvpBuilders, row.rsvps) : null,
      rank: null,
      isLastWeek: row.startTime >= lastWeekStart && row.startTime <= now,
    });
    // Chapter totals leave out events whose projects were collected elsewhere.
    if (hasProjects) {
      chapter.rsvps += row.rsvps;
      chapter.rsvpBuilders += row.rsvpBuilders;
    }
  }

  for (const chapter of chapters.values()) {
    chapter.events.sort(compareEvents);
    for (const [index, event] of chapter.events.entries()) {
      if (event.builtRate !== null) event.rank = index + 1;
    }
    chapter.rankedEvents = chapter.events.filter(
      event => event.rank !== null
    ).length;
    chapter.builtRate = rate(chapter.rsvpBuilders, chapter.rsvps);
  }

  return {
    generatedAt: now.toISOString(),
    minRsvps: MIN_RSVPS,
    lastWeekStart: lastWeekStart.toISOString(),
    chapters: [...chapters.values()].sort(
      (a, b) =>
        b.events.length - a.events.length ||
        a.chapterName.localeCompare(b.chapterName)
    ),
  };
}

export async function loadEventEngagementReport(now = new Date(), db = prisma) {
  return buildEventEngagementReport(
    await loadEventEngagementRows(now, db),
    now
  );
}
