import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { badRequest, requireSiteAdmin } from '@/lib/eventManagementApi';
import { createGlobalBan } from '@/lib/moderation';

export async function GET() {
  try {
    const { response } = await requireSiteAdmin();
    if (response) return response;

    const bans = await prisma.userBan.findMany({
      include: {
        hacker: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        revokedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(bans);
  } catch (error) {
    console.error('[ADMIN_BANS_GET]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { hacker, response } = await requireSiteAdmin();
    if (response) return response;

    const body = await req.json();
    if (!body?.hackerId) return badRequest('hackerId is required');

    const ban = await createGlobalBan({
      hackerId: body.hackerId,
      createdById: hacker!.id,
      publicSafeReason: body.publicSafeReason,
      internalNote: body.internalNote,
    });

    return NextResponse.json(ban, { status: 201 });
  } catch (error) {
    console.error('[ADMIN_BANS_POST]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
