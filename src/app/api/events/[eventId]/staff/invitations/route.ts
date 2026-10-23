import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { badRequest, requireEventStaffManager } from '@/lib/eventManagementApi';
import { sendEventEmail } from '@/lib/eventDelivery';

const selectInvitation = {
  id: true,
  email: true,
  expiresAt: true,
  acceptedAt: true,
  revokedAt: true,
};

export async function GET(
  _request: Request,
  { params }: { params: { eventId: string } }
) {
  const access = await requireEventStaffManager(params.eventId);
  if (access.response) return access.response;
  return NextResponse.json(
    await prisma.eventStaffInvitation.findMany({
      where: { eventId: params.eventId, acceptedAt: null, revokedAt: null },
      select: selectInvitation,
      orderBy: { createdAt: 'desc' },
    })
  );
}

export async function POST(
  request: Request,
  { params }: { params: { eventId: string } }
) {
  try {
    const access = await requireEventStaffManager(params.eventId);
    if (access.response) return access.response;
    const body = await request.json().catch(() => null);
    const email =
      typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return badRequest('Enter a valid email address.');
    }
    const data = {
      invitedById: access.hacker!.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      acceptedAt: null,
      acceptedById: null,
      revokedAt: null,
    };
    const invitation = await prisma.eventStaffInvitation.upsert({
      where: { eventId_email: { eventId: params.eventId, email } },
      create: { eventId: params.eventId, email, ...data },
      update: data,
      select: selectInvitation,
    });
    const link = new URL(
      `/events/staff-invitations/${invitation.id}`,
      request.url
    ).toString();
    const delivery = await sendEventEmail({
      to: email,
      subject: `Co-MC invitation: ${access.event!.title}`,
      body: `You are invited to be a co-MC for ${access.event!.title}.\n\nOpen this page and sign in or create an account. Verify ${email} on your account to accept the invite.\n\n${link}\n\nThis invite expires in 7 days.`,
    });
    return NextResponse.json(
      {
        invitation,
        delivery: {
          sent: delivery.status === 'SENT',
          message:
            delivery.status === 'SENT'
              ? null
              : 'The invite was saved, but the email could not be sent. Use the invite link or send it again.',
          link,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[STAFF_INVITATION_POST]', error);
    return NextResponse.json(
      { message: 'Unable to send the invite.' },
      { status: 500 }
    );
  }
}
