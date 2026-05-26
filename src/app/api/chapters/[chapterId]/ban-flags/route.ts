import { NextResponse } from 'next/server';
import {
  badRequest,
  requireChapterMemberManager,
} from '@/lib/eventManagementApi';
import { createBanFlag } from '@/lib/moderation';

export async function POST(
  req: Request,
  { params }: { params: { chapterId: string } }
) {
  try {
    const { hacker, response } = await requireChapterMemberManager(
      params.chapterId
    );
    if (response) return response;

    const body = await req.json();
    if (!body?.hackerId || !body?.reason) {
      return badRequest('hackerId and reason are required');
    }

    const flag = await createBanFlag({
      chapterId: params.chapterId,
      hackerId: body.hackerId,
      reason: body.reason,
      createdById: hacker!.id,
    });

    return NextResponse.json(flag, { status: 201 });
  } catch (error) {
    console.error('[CHAPTER_BAN_FLAGS_POST]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
