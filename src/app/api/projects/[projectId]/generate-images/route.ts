import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { generatePixelArtImages } from '@/lib/aiImageGeneration';
import prisma from '@/lib/prisma';

function readString(body: Record<string, unknown>, key: string) {
  return body[key];
}

function readStringArray(
  body: Record<string, unknown>,
  key: string
): string[] | null {
  const value = readString(body, key);
  if (!Array.isArray(value) || !value.every(item => typeof item === 'string')) {
    return null;
  }
  return value.map(item => item.trim()).filter(Boolean);
}

export async function POST(
  req: Request,
  { params }: { params: { projectId: string } }
) {
  try {
    const { userId } = auth();
    if (!userId) return new NextResponse('Unauthorized', { status: 401 });

    const body: unknown = await req.json();
    if (body === null || typeof body !== 'object') {
      return new NextResponse('Project details are required', { status: 400 });
    }

    const projectDraft = body as Record<string, unknown>;
    const prompt = readString(projectDraft, 'prompt');
    const title = readString(projectDraft, 'title');
    const preview = readString(projectDraft, 'preview');
    const description = readString(projectDraft, 'description');
    const techTags = readStringArray(projectDraft, 'techTags');
    const domainTags = readStringArray(projectDraft, 'domainTags');

    if (typeof prompt !== 'string' || prompt.trim().length === 0) {
      return new NextResponse('Prompt is required', { status: 400 });
    }
    if (typeof title !== 'string' || title.trim().length === 0) {
      return new NextResponse('Title is required', { status: 400 });
    }
    if (typeof preview !== 'string' || typeof description !== 'string') {
      return new NextResponse('Project descriptions are required', {
        status: 400,
      });
    }
    if (techTags === null || domainTags === null) {
      return new NextResponse('Project tags are invalid', { status: 400 });
    }

    const project = await prisma.project.findUnique({
      where: { id: params.projectId },
      select: { id: true },
    });
    if (!project) {
      return new NextResponse('Project not found', { status: 404 });
    }

    const images = await generatePixelArtImages(`Project: ${title.trim()}
Description: ${preview.trim()}
Full Description: ${description.trim() || preview.trim()}
Tech Stack: ${techTags.join(', ')}
Domain: ${domainTags.join(', ')}

User Request: ${prompt.trim()}`);

    return NextResponse.json({ images });
  } catch (error) {
    console.error('[GENERATE_IMAGES]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
