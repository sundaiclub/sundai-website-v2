export const EVENT_IDEA_LIMITS = {
  name: 100,
  idea: 200,
  description: 2000,
} as const;

export const EVENT_IDEAS_REFRESH_MS = 10_000;

export type EventIdeaInput = {
  name: string;
  idea: string;
  description: string | null;
};

export type PublicEventIdea = EventIdeaInput & {
  id: string;
  createdAt: string;
  // Signed-in authors edit their own ideas; organizers delete any idea.
  canEdit: boolean;
  canDelete: boolean;
};
