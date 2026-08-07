import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireChapterMemberManager } from '@/lib/eventManagementApi';

export async function PATCH(
  req: Request,
  { params }: { params: { chapterId: string; membershipId: string } }
) {
  try {
    const { response } = await requireChapterMemberManager(params.chapterId);
    if (response) return response;

    const body = await req.json();
    const existing = await prisma.chapterMembership.findUnique({
      where: { id: params.membershipId },
    });
    if (!existing || existing.chapterId !== params.chapterId) {
      return new NextResponse('Not Found', { status: 404 });
    }

    if (
      existing.role === 'ADMIN' &&
      existing.status === 'ACTIVE' &&
      (body?.role === 'MEMBER' || body?.status !== undefined)
    ) {
      const adminCount = await prisma.chapterMembership.count({
        where: {
          chapterId: params.chapterId,
          role: 'ADMIN',
          status: 'ACTIVE',
        },
      });
      if (adminCount <= 1) {
        return NextResponse.json(
          { message: 'A chapter must keep at least one active admin' },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.chapterMembership.update({
      where: { id: params.membershipId },
      data: {
        ...(body?.role !== undefined && { role: body.role }),
        ...(body?.status !== undefined && { status: body.status }),
        ...(body?.status === 'REVOKED' && { revokedAt: new Date() }),
        ...(body?.status === 'LEFT' && { leftAt: new Date() }),
        ...(body?.notificationsAllowed !== undefined && {
          notificationsAllowed: body.notificationsAllowed,
        }),
        ...(body?.emailNotificationsEnabled !== undefined && {
          emailNotificationsEnabled: body.emailNotificationsEnabled,
        }),
        ...(body?.smsNotificationsEnabled !== undefined && {
          smsNotificationsEnabled: body.smsNotificationsEnabled,
        }),
      },
      include: { hacker: { select: { id: true, name: true, email: true } } },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('[CHAPTER_MEMBER_PATCH]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
