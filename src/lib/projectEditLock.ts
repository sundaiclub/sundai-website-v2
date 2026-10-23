import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import {
  isProjectLockedForJudging,
  PROJECT_JUDGING_LOCK_MESSAGE,
} from '@/lib/judging';

/** A submission in any event can lock the global project, including its team. */
export async function isProjectEditLocked(
  projectId: string,
  db: Pick<Prisma.TransactionClient, 'judgingSubmission'> = prisma
): Promise<boolean> {
  const submissions = await db.judgingSubmission.findMany({
    where: { projectId },
    select: {
      event: {
        select: {
          judgingEnabled: true,
          judgingOpen: true,
          judgingAssignmentsPublishedAt: true,
          startTime: true,
          endTime: true,
          judgingSubmissionsOpenAt: true,
          judgingSubmissionsCloseAt: true,
        },
      },
    },
  });
  return submissions.some(({ event }) => isProjectLockedForJudging(event));
}

export async function projectEditLockResponse(
  projectId: string,
  isSiteAdmin: boolean
) {
  if (!isSiteAdmin && (await isProjectEditLocked(projectId))) {
    return NextResponse.json(
      { message: PROJECT_JUDGING_LOCK_MESSAGE },
      { status: 409 }
    );
  }
  return null;
}
