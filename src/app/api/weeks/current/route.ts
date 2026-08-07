import { NextResponse } from 'next/server';
import { getOrCreateCurrentWeek } from '@/lib/weeks';

export async function GET() {
  try {
    const currentWeek = await getOrCreateCurrentWeek({
      attendance: {
        include: {
          hacker: {
            select: {
              id: true,
              name: true,
              avatar: true,
              role: true,
            },
          },
        },
        orderBy: {
          timestamp: 'desc',
        },
      },
      projects: {
        include: {
          thumbnail: true,
          launchLead: {
            select: {
              name: true,
              avatar: true,
            },
          },
        },
      },
    });

    return NextResponse.json(currentWeek);
  } catch (error) {
    console.error('[CURRENT_WEEK_GET]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
