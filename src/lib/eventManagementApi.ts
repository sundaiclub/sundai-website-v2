import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import {
  canManageChapterMembers,
  canManageChapterSettings,
} from '@/lib/eventManagementAuth';

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
