import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { generatePixelArtImages } from '@/lib/aiImageGeneration';
import prisma from '@/lib/prisma';

export async function POST(
  req: Request,
  { params }: { params: { projectId: string } }
) {
  try {
    const { userId } = auth();
    if (!userId) return new NextResponse('Unauthorized', { status: 401 });

    const body: unknown = await req.json();
    const prompt =
      body !== null && typeof body === 'object' && 'prompt' in body
        ? body.prompt
        : undefined;
    if (typeof prompt !== 'string' || prompt.trim().length === 0) {
      return new NextResponse('Prompt is required', { status: 400 });
    }

    const project = await prisma.project.findUnique({
      where: { id: params.projectId },
      select: {
        title: true,
        preview: true,
        description: true,
        techTags: { select: { name: true } },
        domainTags: { select: { name: true } },
      },
    });
    if (!project) {
      return new NextResponse('Project not found', { status: 404 });
    }

    const images = await generatePixelArtImages(`Project: ${project.title}
Description: ${project.preview}
Full Description: ${project.description || project.preview}
Tech Stack: ${project.techTags.map(tag => tag.name).join(', ')}
Domain: ${project.domainTags.map(tag => tag.name).join(', ')}

User Request: ${prompt.trim()}`);

    return NextResponse.json({ images });
  } catch (error) {
    console.error('[GENERATE_IMAGES]', error);
    return new NextResponse('Internal Error', { status: 500 });
  }
}
