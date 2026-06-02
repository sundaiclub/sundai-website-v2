import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import type { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import {
  canManagePitchWithContext,
  canManageChapterMembers,
  canManageChapterSettings,
  getChapterMembershipForPermissions,
} from '@/lib/eventManagementAuth';

type EventPitchManagerEvent = Prisma.EventGetPayload<{
  include: { staff: { select: { hackerId: true; role: true } } };
}>;

export async function getCurrentHacker() {
  const { userId } = auth();
  if (!userId) return null;

  return prisma.hacker.findUnique({
    where: { clerkId: userId },
    select: { id: true, role: true, name: true, email: true },
  });
}

export function unauthorized() {
  return new NextResponse('Unauthorized', { status: 401 });
}

export function forbidden() {
  return new NextResponse('Forbidden', { status: 403 });
}

export function notFound() {
  return new NextResponse('Not Found', { status: 404 });
}

function userNotFound() {
  return new NextResponse('User not found', { status: 404 });
}

function eventNotFound() {
  return new NextResponse('Event not found', { status: 404 });
}

export function badRequest(message: string) {
  return NextResponse.json({ message }, { status: 400 });
}

export function isSiteAdmin(
  hacker: Awaited<ReturnType<typeof getCurrentHacker>>
) {
  return hacker?.role === 'SITE_ADMIN';
}

export async function requireSiteAdmin() {
  const hacker = await getCurrentHacker();
  if (!hacker) return { hacker: null, response: unauthorized() };
  if (!isSiteAdmin(hacker)) return { hacker, response: forbidden() };
  return { hacker, response: null };
}

export async function requireChapterManager(chapterId: string) {
  const hacker = await getCurrentHacker();
  if (!hacker) return { hacker: null, response: unauthorized() };

  const allowed = await canManageChapterSettings(prisma, hacker.id, chapterId);
  if (!allowed) return { hacker, response: forbidden() };

  return { hacker, response: null };
}

export async function requireChapterMemberManager(chapterId: string) {
  const hacker = await getCurrentHacker();
  if (!hacker) return { hacker: null, response: unauthorized() };

  const allowed = await canManageChapterMembers(prisma, hacker.id, chapterId);
  if (!allowed) return { hacker, response: forbidden() };

  return { hacker, response: null };
}

export async function requireEventPitchManager(eventId: string) {
  const { userId } = auth();
  if (!userId) {
    return { hacker: null, event: null, response: unauthorized() };
  }

  const hacker = await prisma.hacker.findUnique({
    where: { clerkId: userId },
    select: { id: true, role: true },
  });
  if (!hacker) {
    return { hacker: null, event: null, response: userNotFound() };
  }

  const event = (await prisma.event.findUnique({
    where: { id: eventId },
    include: { staff: { select: { hackerId: true, role: true } } },
  })) as EventPitchManagerEvent | null;
  if (!event) {
    return { hacker, event: null, response: eventNotFound() };
  }

  const chapterMembership = await getChapterMembershipForPermissions(
    prisma,
    hacker.id,
    event.chapterId
  );
  const staff =
    event.staff.find((staffMember) => staffMember.hackerId === hacker.id) ??
    null;

  const allowed = canManagePitchWithContext({
    actor: hacker,
    chapterMembership,
    staff,
  });

  if (!allowed) {
    return { hacker, event, response: unauthorized() };
  }

  return { hacker, event, response: null };
}
