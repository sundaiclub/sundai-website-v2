import prisma from '@/lib/prisma';
import { getCurrentHacker } from '@/lib/eventManagementApi';
import {
  canManageEventIdeasWithContext,
  getEventPermissionContext,
} from '@/lib/eventManagementAuth';
import { publicEventVisibilityWhere } from '@/lib/publicEvents';
import {
  EVENT_IDEA_LIMITS,
  type EventIdeaInput,
  type PublicEventIdea,
} from '@/types/event-ideas';

const IDEA_SELECT = {
  id: true,
  hackerId: true,
  name: true,
  idea: true,
  description: true,
  createdAt: true,
} as const;

type IdeaRecord = {
  id: string;
  hackerId: string | null;
  name: string;
  idea: string;
  description: string | null;
  createdAt: Date;
};

export type EventIdeasViewer = {
  hackerId: string | null;
  name: string | null;
  canModerate: boolean;
};

// The author's hacker id stays on the server; viewers only see what they can do.
function toPublicIdea(
  { hackerId, createdAt, ...record }: IdeaRecord,
  viewer: EventIdeasViewer
): PublicEventIdea {
  return {
    ...record,
    createdAt: createdAt.toISOString(),
    canEdit: Boolean(viewer.hackerId && hackerId === viewer.hackerId),
    canDelete: viewer.canModerate,
  };
}

function trimmedString(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

export function parseEventIdeaInput(
  body: unknown
): { input: EventIdeaInput } | { error: string } {
  const values = (body && typeof body === 'object' ? body : {}) as Record<
    string,
    unknown
  >;
  const name = trimmedString(values.name);
  const idea = trimmedString(values.idea);
  const description = trimmedString(values.description);

  if (!name) return { error: 'Name is required' };
  if (!idea) return { error: 'Idea is required' };
  if (name.length > EVENT_IDEA_LIMITS.name) {
    return {
      error: `Name must be ${EVENT_IDEA_LIMITS.name} characters or fewer`,
    };
  }
  if (idea.length > EVENT_IDEA_LIMITS.idea) {
    return {
      error: `Idea must be ${EVENT_IDEA_LIMITS.idea} characters or fewer`,
    };
  }
  if (description.length > EVENT_IDEA_LIMITS.description) {
    return {
      error: `Description must be ${EVENT_IDEA_LIMITS.description} characters or fewer`,
    };
  }

  return { input: { name, idea, description: description || null } };
}

export async function findPublicEventId(eventId: string) {
  const event = await prisma.event.findFirst({
    where: { id: eventId, ...publicEventVisibilityWhere() },
    select: { id: true },
  });
  return event?.id ?? null;
}

export async function getEventIdeasViewer(
  eventId: string
): Promise<EventIdeasViewer> {
  const hacker = await getCurrentHacker();
  if (!hacker) return { hackerId: null, name: null, canModerate: false };

  const context = await getEventPermissionContext(prisma, hacker.id, eventId);
  return {
    hackerId: hacker.id,
    name: hacker.name,
    canModerate: Boolean(context && canManageEventIdeasWithContext(context)),
  };
}

export async function listEventIdeas(
  eventId: string,
  viewer: EventIdeasViewer
) {
  const ideas = await prisma.eventIdea.findMany({
    where: { eventId },
    orderBy: { createdAt: 'desc' },
    select: IDEA_SELECT,
  });
  return ideas.map(idea => toPublicIdea(idea, viewer));
}

export async function createEventIdea({
  eventId,
  viewer,
  input,
}: {
  eventId: string;
  viewer: EventIdeasViewer;
  input: EventIdeaInput;
}) {
  const idea = await prisma.eventIdea.create({
    data: { eventId, hackerId: viewer.hackerId, ...input },
    select: IDEA_SELECT,
  });
  return toPublicIdea(idea, viewer);
}

export async function findEventIdeaAuthor(eventId: string, ideaId: string) {
  return prisma.eventIdea.findFirst({
    where: { id: ideaId, eventId },
    select: { hackerId: true },
  });
}

export async function updateEventIdea({
  ideaId,
  viewer,
  input,
}: {
  ideaId: string;
  viewer: EventIdeasViewer;
  input: EventIdeaInput;
}) {
  const idea = await prisma.eventIdea.update({
    where: { id: ideaId },
    data: input,
    select: IDEA_SELECT,
  });
  return toPublicIdea(idea, viewer);
}

export async function deleteEventIdea(eventId: string, ideaId: string) {
  const { count } = await prisma.eventIdea.deleteMany({
    where: { id: ideaId, eventId },
  });
  return count > 0;
}
