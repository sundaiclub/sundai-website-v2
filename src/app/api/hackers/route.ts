import { privateJson } from '@/lib/publicData';
import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return privateJson({ error: 'Unauthorized' }, { status: 401 });
    const { searchParams } = new URL(request.url);
    const clerkId = searchParams.get('clerkId');

    if (clerkId) {
      if (clerkId !== userId) {
        return privateJson({ error: 'Forbidden' }, { status: 403 });
      }
      const hacker = await prisma.hacker.findUnique({
        where: { clerkId },
        select: {
          id: true,
          name: true,
          role: true,
        },
      });

      if (!hacker) {
        return privateJson({ error: 'Builder not found' }, { status: 404 });
      }

      return privateJson({
        id: hacker.id,
        name: hacker.name,
        role: hacker.role,
      });
    }

    const hackers = await prisma.hacker.findMany({
      select: {
        id: true,
        name: true,
      },
    });

    return privateJson(hackers.map(({ id, name }) => ({ id, name })));
  } catch (error) {
    console.error('Error fetching builder:', error);
    return privateJson({ error: 'Error fetching builder' }, { status: 500 });
  }
}
