// How many people who RSVP'd to a hack ended up on a project submitted to it.
export type EventEngagementRow = {
  eventId: string;
  title: string;
  startTime: string;
  rsvps: number;
  projects: number;
  presented: number;
  rsvpBuilders: number;
  // Null when the event has no projects on the site, which usually means
  // submissions were collected somewhere else.
  builtRate: number | null;
  rank: number | null;
  isLastWeek: boolean;
};

export type ChapterEngagement = {
  chapterId: string;
  chapterName: string;
  rsvps: number;
  rsvpBuilders: number;
  builtRate: number | null;
  rankedEvents: number;
  events: EventEngagementRow[];
};

export type EventEngagementReport = {
  generatedAt: string;
  minRsvps: number;
  lastWeekStart: string;
  chapters: ChapterEngagement[];
};
