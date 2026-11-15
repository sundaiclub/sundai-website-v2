import { NextResponse } from 'next/server';
import {
  deleteEventIdea,
  findEventIdeaAuthor,
  findPublicEventId,
  getEventIdeasViewer,
  parseEventIdeaInput,
  updateEventIdea,
} from '@/lib/eventIdeas';

type IdeaRouteProps = { params: Promise<{ eventId: string; ideaId: string }> };

function ideaNotFound() {
  return NextResponse.json({ message: 'Idea not found' }, { status: 404 });
}

// Signed-in authors can edit their own ideas.
export async function PATCH(req: Request, props: IdeaRouteProps) {
  const params = await props.params;
  try {
    const eventId = await findPublicEventId(params.eventId);
    if (!eventId) return ideaNotFound();

    const viewer = await getEventIdeasViewer(eventId);
    if (!viewer.hackerId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const existing = await findEventIdeaAuthor(eventId, params.ideaId);
    if (!existing) return ideaNotFound();
    if (existing.hackerId !== viewer.hackerId) {
      return NextResponse.json(
        { message: 'You can only edit your own ideas' },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => null);
    const parsed = parseEventIdeaInput(body);
    if ('error' in parsed) {
      return NextResponse.json({ message: parsed.error }, { status: 400 });
    }

    const idea = await updateEventIdea({
      ideaId: params.ideaId,
      viewer,
      input: parsed.input,
    });
    return NextResponse.json(idea);
  } catch (error) {
    console.error('[EVENT_IDEA_PATCH]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}

// Signed-in authors can remove their own ideas; organizers can remove any idea.
export async function DELETE(_req: Request, props: IdeaRouteProps) {
  const params = await props.params;
  try {
    const viewer = await getEventIdeasViewer(params.eventId);
    if (!viewer.hackerId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    if (!viewer.canModerate) {
      const existing = await findEventIdeaAuthor(params.eventId, params.ideaId);
      if (!existing) return ideaNotFound();
      if (existing.hackerId !== viewer.hackerId) {
        return NextResponse.json(
          { message: 'You can only delete your own ideas' },
          { status: 403 }
        );
      }
    }

    if (!(await deleteEventIdea(params.eventId, params.ideaId))) {
      return ideaNotFound();
    }
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('[EVENT_IDEA_DELETE]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
