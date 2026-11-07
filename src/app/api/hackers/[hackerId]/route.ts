import { visibleProjectsWhere } from '@/lib/projectVisibility';
import {
  privateJson,
  publicFields,
  publicHackerSelect,
  publicImageSelect,
  publicProjectSelect,
} from '@/lib/publicData';
import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import type { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { phoneNumberForStorage } from '@/lib/phoneNumbers';
import { HttpsUrlInputError, normalizeOptionalHttpsUrl } from '@/lib/httpsUrls';

const REQUIRED_HACKER_UPDATE_FIELDS = ['name'] as const;

const NULLABLE_HACKER_UPDATE_FIELDS = [
  'bio',
  'githubUrl',
  'phoneNumber',
  'linkedinUrl',
  'twitterUrl',
  'username',
  'discordName',
  'websiteUrl',
] as const;

const ALLOWED_HACKER_UPDATE_FIELDS = [
  ...REQUIRED_HACKER_UPDATE_FIELDS,
  ...NULLABLE_HACKER_UPDATE_FIELDS,
] as const;

const HACKER_URL_FIELD_LABELS: Partial<
  Record<(typeof NULLABLE_HACKER_UPDATE_FIELDS)[number], string>
> = {
  githubUrl: 'GitHub URL',
  linkedinUrl: 'LinkedIn URL',
  twitterUrl: 'Twitter URL',
  websiteUrl: 'Website URL',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}

function profileRelations(projectVisibility: Prisma.ProjectWhereInput) {
  return {
    avatar: { select: publicImageSelect },
    ledProjects: {
      where: projectVisibility,
      select: publicProjectSelect,
      orderBy: { createdAt: 'desc' as const },
    },
    projects: {
      where: { project: projectVisibility },
      select: { role: true, project: { select: publicProjectSelect } },
      orderBy: { createdAt: 'desc' as const },
    },
    likes: {
      where: { project: projectVisibility },
      select: { createdAt: true, project: { select: publicProjectSelect } },
      orderBy: { createdAt: 'desc' as const },
    },
  } satisfies Prisma.HackerInclude;
}

export async function GET(
  request: Request,
  props: { params: Promise<{ hackerId: string }> }
) {
  const params = await props.params;
  try {
    const { userId } = await auth();
    const projectVisibility = visibleProjectsWhere(userId);
    const hacker = await prisma.hacker.findUnique({
      where: { id: params.hackerId },
      include: profileRelations(projectVisibility),
    });

    if (!hacker) {
      return privateJson({ error: 'Builder not found' }, { status: 404 });
    }

    const { likes, ...hackerWithoutLikes } = hacker;
    const visibleProjectIds = new Set([
      ...hacker.ledProjects.map(project => project.id),
      ...hacker.projects.map(participation => participation.project.id),
    ]);
    const transformedHacker = {
      ...publicFields(hackerWithoutLikes, publicHackerSelect),
      ...(userId && hacker.clerkId === userId
        ? {
            email: hacker.email,
            phoneNumber: hacker.phoneNumber,
            role: hacker.role,
          }
        : {}),
      ledProjects: publicFields(hacker.ledProjects, publicProjectSelect),
      projects: publicFields(hacker.projects, {
        role: true,
        project: { select: publicProjectSelect },
      }),
      featuredProjectIds:
        hacker.featuredProjectIds?.filter(id => visibleProjectIds.has(id)) ??
        [],
      ...(userId && hacker.clerkId === userId
        ? {
            likedProjects: publicFields(likes, {
              createdAt: true,
              project: { select: publicProjectSelect },
            }),
          }
        : {}),
    };

    return privateJson(transformedHacker);
  } catch (error) {
    console.error('Error fetching hacker:', error);
    return privateJson({ error: 'Error fetching hacker' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  props: { params: Promise<{ hackerId: string }> }
) {
  const params = await props.params;
  try {
    const { userId } = await auth();
    if (!userId) {
      return privateJson('Unauthorized', { status: 401 });
    }

    const requestingHacker = await prisma.hacker.findUnique({
      where: { clerkId: userId },
    });

    if (!requestingHacker) {
      return privateJson({ error: 'Builder not found' }, { status: 404 });
    }

    if (requestingHacker.id !== params.hackerId) {
      return privateJson({ error: 'Unauthorized' }, { status: 401 });
    }

    const data: unknown = await request.json();

    const sanitizedData: Prisma.HackerUpdateInput = {};

    if (isRecord(data)) {
      if (typeof data.name === 'string') {
        sanitizedData.name = data.name;
      }

      for (const key of NULLABLE_HACKER_UPDATE_FIELDS) {
        const value = data[key];
        if (typeof value === 'string' || value === null) {
          const urlFieldLabel = HACKER_URL_FIELD_LABELS[key];
          sanitizedData[key] =
            key === 'phoneNumber' && typeof value === 'string'
              ? phoneNumberForStorage(value)
              : urlFieldLabel
                ? normalizeOptionalHttpsUrl(value, urlFieldLabel)
                : value;
        }
      }
    }

    const projectVisibility = visibleProjectsWhere(userId);
    const updatedHacker = await prisma.hacker.update({
      where: { id: params.hackerId },
      data: sanitizedData,
      include: profileRelations(projectVisibility),
    });

    return privateJson({
      ...publicFields(updatedHacker, publicHackerSelect),
      email: updatedHacker.email,
      phoneNumber: updatedHacker.phoneNumber,
      role: updatedHacker.role,
      ledProjects: publicFields(updatedHacker.ledProjects, publicProjectSelect),
      projects: publicFields(updatedHacker.projects, {
        role: true,
        project: { select: publicProjectSelect },
      }),
      featuredProjectIds: updatedHacker.featuredProjectIds ?? [],
    });
  } catch (error) {
    if (error instanceof HttpsUrlInputError) {
      return privateJson({ error: error.message }, { status: 400 });
    }
    console.error('Error updating builder:', error);
    return privateJson({ error: 'Error updating builder' }, { status: 500 });
  }
}
