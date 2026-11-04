import type { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';

export const publicImageSelect = { url: true, alt: true } as const;

// Keep contact, account, consent, attendance, and storage data out of public APIs.
export const publicHackerSelect = {
  id: true,
  name: true,
  username: true,
  bio: true,
  githubUrl: true,
  discordName: true,
  twitterUrl: true,
  linkedinUrl: true,
  websiteUrl: true,
  avatar: { select: publicImageSelect },
} as const satisfies Prisma.HackerSelect;

export const publicProjectSelect = {
  id: true,
  title: true,
  preview: true,
  description: true,
  githubUrl: true,
  demoUrl: true,
  blogUrl: true,
  startDate: true,
  endDate: true,
  status: true,
  hack_type: true,
  createdAt: true,
  updatedAt: true,
  is_starred: true,
  is_broken: true,
  thumbnail: { select: publicImageSelect },
  launchLead: { select: publicHackerSelect },
  participants: {
    select: { role: true, hacker: { select: publicHackerSelect } },
  },
  techTags: { select: { id: true, name: true, description: true } },
  domainTags: { select: { id: true, name: true, description: true } },
  likes: { select: { hackerId: true, createdAt: true } },
} as const satisfies Prisma.ProjectSelect;

export const publicChapterSelect = {
  id: true,
  name: true,
  slug: true,
  city: true,
  region: true,
  country: true,
  timezone: true,
  description: true,
  status: true,
  accessMode: true,
  createdAt: true,
  updatedAt: true,
  heroImage: { select: publicImageSelect },
} as const satisfies Prisma.ChapterSelect;

export const privateResponseHeaders = { 'Cache-Control': 'private, no-store' };

export function privateJson(
  body: unknown,
  init?: Omit<ResponseInit, 'headers'>
) {
  return NextResponse.json(body, { ...init, headers: privateResponseHeaders });
}

/** Project only named fields, including nested records, at the response boundary. */
export function publicFields<T>(
  value: T,
  selection: Record<string, unknown>
): T {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value.map(item => publicFields(item, selection)) as T;
  }
  const record = value as Record<string, unknown>;
  return Object.fromEntries(
    Object.entries(selection)
      .filter(([key]) => Object.hasOwn(record, key))
      .map(([key, field]) => [
        key,
        field === true
          ? record[key]
          : publicFields(
              record[key],
              (field as { select: Record<string, unknown> }).select
            ),
      ])
  ) as T;
}
