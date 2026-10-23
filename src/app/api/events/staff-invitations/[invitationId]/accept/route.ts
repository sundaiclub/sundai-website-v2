import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import { approveEventStaffRegistrations } from '@/lib/eventStaffRegistrations';

export async function POST(
  _request: Request,
  { params }: { params: { invitationId: string } }
) {
  try {
    const { userId } = auth();
    if (!userId)
      return NextResponse.json(
        { message: 'Sign in or create an account to accept this invite.' },
        { status: 401 }
      );
    const [user, invitation, hacker] = await Promise.all([
      currentUser(),
      prisma.eventStaffInvitation.findUnique({
        where: { id: params.invitationId },
      }),
      prisma.hacker.findUnique({
        where: { clerkId: userId },
        select: { id: true },
      }),
    ]);
    if (!invitation)
      return NextResponse.json(
        { message: 'Invite not found.' },
        { status: 404 }
      );
    const verified =
      user?.id === userId &&
      user.emailAddresses.some(
        address =>
          address.verification?.status === 'verified' &&
          address.emailAddress.trim().toLowerCase() === invitation.email
      );
    if (!verified)
      return NextResponse.json(
        {
          message:
            'Sign in with an account that has verified the invited email address.',
        },
        { status: 403 }
      );
    if (!hacker)
      return NextResponse.json(
        {
          message:
            'Your account is being prepared. Try again in a few seconds.',
        },
        { status: 409 }
      );
    const workspaceUrl = `/organizer/events/${invitation.eventId}`;
    if (invitation.acceptedAt) {
      const staff = await prisma.eventStaff.findUnique({
        where: {
          eventId_hackerId: {
            eventId: invitation.eventId,
            hackerId: hacker.id,
          },
        },
      });
      if (invitation.acceptedById === hacker.id && staff)
        return NextResponse.json({ workspaceUrl });
      return NextResponse.json(
        { message: 'This invite has already been used.' },
        { status: 410 }
      );
    }
    const accepted = await prisma.$transaction(async tx => {
      // Claim first. Revocation and acceptance must not both succeed.
      const claimed = await tx.eventStaffInvitation.updateMany({
        where: {
          id: invitation.id,
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { acceptedAt: new Date(), acceptedById: hacker.id },
      });
      if (!claimed.count) return false;
      const existing = await tx.eventStaff.findUnique({
        where: {
          eventId_hackerId: {
            eventId: invitation.eventId,
            hackerId: hacker.id,
          },
        },
      });
      // Preserve an existing MC assignment.
      await tx.eventStaff.upsert({
        where: {
          eventId_hackerId: {
            eventId: invitation.eventId,
            hackerId: hacker.id,
          },
        },
        create: {
          eventId: invitation.eventId,
          hackerId: hacker.id,
          role: 'CO_MC',
        },
        update: {},
      });
      if (!existing)
        await tx.eventStaffAudit.create({
          data: {
            eventId: invitation.eventId,
            staffHackerId: hacker.id,
            actorId: invitation.invitedById,
            action: 'ASSIGNED',
            fromRole: null,
            toRole: 'CO_MC',
          },
        });
      await approveEventStaffRegistrations(tx, {
        eventId: invitation.eventId,
        hackerIds: [hacker.id],
        actorId: invitation.invitedById,
      });
      return true;
    });
    if (!accepted) {
      // A repeated page effect can race the first acceptance. Return the same
      // workspace only if this account still has the granted staff access.
      const latest = await prisma.eventStaffInvitation.findUnique({
        where: { id: invitation.id },
      });
      const staff =
        latest?.acceptedById === hacker.id && latest.acceptedAt
          ? await prisma.eventStaff.findUnique({
              where: {
                eventId_hackerId: {
                  eventId: invitation.eventId,
                  hackerId: hacker.id,
                },
              },
            })
          : null;
      if (!staff)
        return NextResponse.json(
          {
            message:
              'This invite has expired, was cancelled, or has already been used.',
          },
          { status: 410 }
        );
    }
    return NextResponse.json({ workspaceUrl });
  } catch (error) {
    console.error('[STAFF_INVITATION_ACCEPT]', error);
    return NextResponse.json(
      { message: 'Unable to accept this invite. Try again.' },
      { status: 500 }
    );
  }
}
