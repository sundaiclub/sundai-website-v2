import type { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';

export async function getOrCreateCurrentWeek<
  TInclude extends Prisma.WeekInclude | undefined = undefined,
>(include?: TInclude): Promise<Prisma.WeekGetPayload<{ include: TInclude }>> {
  const now = new Date();
  const currentWeek = await prisma.week.findFirst({
    where: {
      startDate: { lte: now },
      endDate: { gte: now },
    },
    include,
  });

  if (currentWeek) {
    return currentWeek as Prisma.WeekGetPayload<{ include: TInclude }>;
  }

  const startDate = new Date(now);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 6);
  endDate.setHours(23, 59, 59, 999);

  const latestWeek = await prisma.week.findFirst({
    orderBy: { number: 'desc' },
    select: { number: true },
  });
  const number = (latestWeek?.number ?? 0) + 1;

  const createdWeek = await prisma.week.create({
    data: {
      number,
      startDate,
      endDate,
      theme: `Week ${number}`,
      description: `Projects for week ${number}`,
    },
    include,
  });

  return createdWeek as Prisma.WeekGetPayload<{ include: TInclude }>;
}
