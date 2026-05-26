import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireSiteAdmin } from '@/lib/eventManagementApi';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { response } = await requireSiteAdmin();
    if (response) return response;

    const flags = await prisma.userBanFlag.findMany({
      include: {
        chapter: { select: { id: true, name: true, slug: true } },
        hacker: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true, email: true } },
        resolvedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(flags);
  } catch (error) {
    console.error('[ADMIN_BAN_FLAGS_GET]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
