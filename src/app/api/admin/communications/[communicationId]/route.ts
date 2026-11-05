import { NextResponse } from 'next/server';
import { loadAdminCommunicationGroups } from '@/lib/adminCommunications';
import { requireSiteAdmin } from '@/lib/eventManagementApi';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: Request,
  props: { params: Promise<{ communicationId: string }> }
) {
  const params = await props.params;
  try {
    const { response } = await requireSiteAdmin();
    if (response) return response;

    const where = { sentAt: { not: null } };
    const item = await prisma.eventCommunication.findFirst({
      where: { ...where, id: params.communicationId },
      select: { eventId: true, sendGroupId: true },
    });
    const [group] = item
      ? await loadAdminCommunicationGroups(where, [item])
      : [];
    if (!group) {
      return NextResponse.json(
        { message: 'Communication not found.' },
        { status: 404 }
      );
    }
    return NextResponse.json(group);
  } catch (error) {
    console.error('[ADMIN_COMMUNICATION_GET]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
