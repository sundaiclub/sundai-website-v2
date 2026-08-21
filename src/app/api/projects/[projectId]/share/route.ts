export const runtime = 'nodejs';
export const maxDuration = 300;

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';
import {
  buildShareContentPrompt,
  generateShareContent,
  SHARE_CONTENT_MODEL,
  type SharePlatform,
} from '@/lib/shareContent';
import type { Project } from '@/types/project';

type ShareRequestBody = {
  platform?: unknown;
};

const SHARE_PLATFORMS = new Set<SharePlatform>([
  'twitter',
  'linkedin',
  'reddit',
]);

function isSharePlatform(value: unknown): value is SharePlatform {
  return (
    typeof value === 'string' && SHARE_PLATFORMS.has(value as SharePlatform)
  );
}

export async function POST(
  req: Request,
  props: { params: Promise<{ projectId: string }> }
) {
  const params = await props.params;
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const body = (await req.json()) as ShareRequestBody;
    const { platform } = body;

    if (!isSharePlatform(platform)) {
      return new NextResponse('Invalid platform', { status: 400 });
    }

    const currentUser = await prisma.hacker.findUnique({
      where: { clerkId: userId },
    });

    if (!currentUser) {
      return new NextResponse('User not found', { status: 404 });
    }

    const project = await prisma.project.findUnique({
      where: { id: params.projectId },
      include: {
        launchLead: {
          select: {
            id: true,
            name: true,
            twitterUrl: true,
            linkedinUrl: true,
            avatar: {
              select: {
                url: true,
              },
            },
          },
        },
        participants: {
          include: {
            hacker: {
              select: {
                id: true,
                name: true,
                bio: true,
                twitterUrl: true,
                linkedinUrl: true,
                avatar: {
                  select: {
                    url: true,
                  },
                },
              },
            },
          },
        },
        techTags: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        domainTags: {
          select: {
            id: true,
            name: true,
            description: true,
          },
        },
        thumbnail: {
          select: {
            url: true,
          },
        },
        likes: {
          select: {
            hackerId: true,
            createdAt: true,
          },
        },
      },
    });

    if (!project) {
      return new NextResponse('Project not found', { status: 404 });
    }

    const isTeamMember =
      project.participants.some(p => p.hacker.id === currentUser.id) ||
      project.launchLeadId === currentUser.id;

    const projectData: Project = {
      id: project.id,
      title: project.title,
      preview: project.preview || project.title,
      description:
        project.description || project.preview || 'No description available',
      githubUrl: project.githubUrl,
      demoUrl: project.demoUrl,
      blogUrl: project.blogUrl,
      launchLead: {
        id: project.launchLead.id,
        name: project.launchLead.name,
        twitterUrl: project.launchLead.twitterUrl,
        linkedinUrl: project.launchLead.linkedinUrl,
        avatar: project.launchLead.avatar,
      },
      participants: project.participants.map(p => ({
        role: p.role || 'hacker',
        hacker: {
          id: p.hacker.id,
          name: p.hacker.name,
          bio: p.hacker.bio,
          twitterUrl: p.hacker.twitterUrl,
          linkedinUrl: p.hacker.linkedinUrl,
          avatar: p.hacker.avatar,
        },
      })),
      techTags: project.techTags,
      domainTags: project.domainTags,
      startDate: project.startDate,
      endDate: project.endDate,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
      status: project.status,
      is_starred: false,
      is_broken: false,
      thumbnail: project.thumbnail,
      likes: project.likes.map(like => ({
        hackerId: like.hackerId,
        createdAt: like.createdAt.toISOString(),
      })),
    };

    const acceptHeader = req.headers.get('accept') || '';
    const wantsStream =
      acceptHeader.includes('text/event-stream') ||
      acceptHeader.includes('text/plain');

    if (wantsStream) {
      const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
      if (!apiKey) {
        return new NextResponse('Gemini API key not configured', {
          status: 500,
        });
      }

      const prompt = buildShareContentPrompt({
        project: projectData,
        platform,
        isTeamMember,
      });

      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey });
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          try {
            const response = await ai.models.generateContentStream({
              model: SHARE_CONTENT_MODEL,
              contents: prompt,
            });
            for await (const chunk of response) {
              const text = chunk.text || '';
              if (text) controller.enqueue(encoder.encode(text));
            }
            controller.close();
          } catch (error) {
            console.error('[SHARE_STREAM]', error);
            controller.error(error);
          }
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-cache',
        },
      });
    }

    const shareContent = await generateShareContent({
      project: projectData,
      platform,
      isTeamMember,
    });

    return NextResponse.json(shareContent);
  } catch (error) {
    console.error('[SHARE_CONTENT_GENERATION]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
