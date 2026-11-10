import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import {
  createEventIdea,
  findPublicEventId,
  listEventIdeas,
  parseEventIdeaInput,
} from '@/lib/eventIdeas';

type IdeasRouteProps = { params: Promise<{ eventId: string }> };

export async function GET(_req: Request, props: IdeasRouteProps) {
  const params = await props.params;
  try {
    const eventId = await findPublicEventId(params.eventId);
    if (!eventId) {
      return NextResponse.json({ message: 'Event not found' }, { status: 404 });
    }

    return NextResponse.json(
      { ideas: await listEventIdeas(eventId) },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('[EVENT_IDEAS_GET]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}

// Signed-out visitors can share ideas too; signed-in authors are linked.
export async function POST(req: Request, props: IdeasRouteProps) {
  const params = await props.params;
  try {
    const eventId = await findPublicEventId(params.eventId);
    if (!eventId) {
      return NextResponse.json({ message: 'Event not found' }, { status: 404 });
    }

    const body = await req.json().catch(() => null);
    const parsed = parseEventIdeaInput(body);
    if ('error' in parsed) {
      return NextResponse.json({ message: parsed.error }, { status: 400 });
    }

    const { userId } = await auth();
    const hacker = userId
      ? await prisma.hacker.findUnique({
          where: { clerkId: userId },
          select: { id: true },
        })
      : null;

    const idea = await createEventIdea({
      eventId,
      hackerId: hacker?.id ?? null,
      input: parsed.input,
    });
    return NextResponse.json(idea, { status: 201 });
  } catch (error) {
    console.error('[EVENT_IDEAS_POST]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
