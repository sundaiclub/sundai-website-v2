import { auth } from '@clerk/nextjs/server';
import { SignInAction } from '@/app/components/SignInAction';
import {
  ManagementEmptyState,
  ManagementHeader,
  ManagementPage,
} from '@/app/components/ManagementSurface';
import prisma from '@/lib/prisma';
import PitchLandingClient from './PitchLandingClient';

export const dynamic = 'force-dynamic';

function SignInPrompt() {
  return (
    <ManagementPage maxWidth="max-w-4xl">
      <ManagementHeader
        title="Pitch"
        description="Sign in to see active events where you can add a project."
      />
      <ManagementEmptyState>
        <div className="flex flex-col items-center gap-4">
          <span>Sign in to view your active events.</span>
          <SignInAction />
        </div>
      </ManagementEmptyState>
    </ManagementPage>
  );
}

export default async function PitchLandingPage() {
  const { userId } = auth();
  if (!userId) return <SignInPrompt />;

  const hacker = await prisma.hacker.findUnique({
    where: { clerkId: userId },
    select: { id: true, role: true },
  });
  if (!hacker) return <SignInPrompt />;

  const now = new Date();
  const events = await prisma.event.findMany({
    where: {
      status: 'PUBLISHED',
      startTime: { lte: now },
      endTime: { gte: now },
      pitchSessions: { some: { phase: { not: 'FINISHED' } } },
      ...(hacker.role === 'SITE_ADMIN'
        ? {}
        : {
            OR: [
              {
                registrations: {
                  some: {
                    hackerId: hacker.id,
                    status: 'APPROVED' as const,
                    cancelledAt: null,
                  },
                },
              },
              { staff: { some: { hackerId: hacker.id } } },
              {
                chapter: {
                  memberships: {
                    some: {
                      hackerId: hacker.id,
                      role: 'ADMIN' as const,
                      status: 'ACTIVE' as const,
                    },
                  },
                },
              },
            ],
          }),
    },
    orderBy: [{ endTime: 'asc' }, { title: 'asc' }],
    select: {
      id: true,
      title: true,
      slug: true,
      chapter: { select: { name: true, slug: true } },
    },
  });

  return (
    <PitchLandingClient
      events={events.map(event => ({
        id: event.id,
        title: event.title,
        slug: event.slug,
        chapterName: event.chapter.name,
        chapterSlug: event.chapter.slug,
      }))}
    />
  );
}
