import prisma from '@/lib/prisma';
import { publicEventVisibilityWhere } from '@/lib/publicEvents';
import {
  EVENT_IDEA_LIMITS,
  type EventIdeaInput,
  type PublicEventIdea,
} from '@/types/event-ideas';

const PUBLIC_IDEA_SELECT = {
  id: true,
  name: true,
  idea: true,
  description: true,
  createdAt: true,
} as const;

type IdeaRecord = {
  id: string;
  name: string;
  idea: string;
  description: string | null;
  createdAt: Date;
};

function toPublicIdea(record: IdeaRecord): PublicEventIdea {
  return { ...record, createdAt: record.createdAt.toISOString() };
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

export async function listEventIdeas(eventId: string) {
  const ideas = await prisma.eventIdea.findMany({
    where: { eventId },
    orderBy: { createdAt: 'desc' },
    select: PUBLIC_IDEA_SELECT,
  });
  return ideas.map(toPublicIdea);
}

export async function createEventIdea({
  eventId,
  hackerId,
  input,
}: {
  eventId: string;
  hackerId: string | null;
  input: EventIdeaInput;
}) {
  const idea = await prisma.eventIdea.create({
    data: { eventId, hackerId, ...input },
    select: PUBLIC_IDEA_SELECT,
  });
  return toPublicIdea(idea);
}
