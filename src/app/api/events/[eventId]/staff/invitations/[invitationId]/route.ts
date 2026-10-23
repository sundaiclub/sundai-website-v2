import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireEventStaffManager } from '@/lib/eventManagementApi';

export async function DELETE(
  _request: Request,
  { params }: { params: { eventId: string; invitationId: string } }
) {
  const access = await requireEventStaffManager(params.eventId);
  if (access.response) return access.response;
  const result = await prisma.eventStaffInvitation.updateMany({
    where: {
      id: params.invitationId,
      eventId: params.eventId,
      acceptedAt: null,
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  });
  return new NextResponse(null, { status: result.count ? 204 : 404 });
}
