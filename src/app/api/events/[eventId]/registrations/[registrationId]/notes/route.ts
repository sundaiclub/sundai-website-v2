import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  forbidden,
  getCurrentHacker,
  notFound,
  unauthorized,
} from '@/lib/eventManagementApi';
import { canEditRegistrationNotes } from '@/lib/eventManagementAuth';

async function updateNotes(
  req: Request,
  { params }: { params: { eventId: string; registrationId: string } }
) {
  try {
    const hacker = await getCurrentHacker();
    if (!hacker) return unauthorized();

    const allowed = await canEditRegistrationNotes(
      prisma,
      hacker.id,
      params.eventId
    );
    if (!allowed) return forbidden();

    const existingRegistration = await prisma.eventRegistration.findFirst({
      where: {
        id: params.registrationId,
        eventId: params.eventId,
      },
    });
    if (!existingRegistration) return notFound();

    const body = await req.json();
    const internalReviewNotes = body?.internalReviewNotes ?? null;
    const registration = await prisma.eventRegistration.update({
      where: { id: params.registrationId },
      data: { internalReviewNotes },
    });

    await prisma.eventRegistrationAudit.create({
      data: {
        registrationId: params.registrationId,
        eventId: params.eventId,
        actorId: hacker.id,
        fromStatus: existingRegistration.status,
        toStatus: existingRegistration.status,
        changeJson: {
          action: 'UPDATE_INTERNAL_REVIEW_NOTES',
          internalReviewNotesChanged:
            internalReviewNotes !== existingRegistration.internalReviewNotes,
        },
      },
    });

    return NextResponse.json(registration);
  } catch (error) {
    console.error('[EVENT_REGISTRATION_NOTES_UPDATE]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}

export const POST = updateNotes;
export const PATCH = updateNotes;
