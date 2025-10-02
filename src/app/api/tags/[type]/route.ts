import { NextResponse } from 'next/server';
import prisma from "@/lib/prisma";

export async function GET(
    request: Request,
    { params }: { params: { type: string } }
) {
    try {
    // Convert the type parameter to uppercase and validate it
    const tagType = params.type.toUpperCase();
    if (!['TECH', 'DOMAIN'].includes(tagType)) {
    return NextResponse.json(
        { error: 'Invalid tag type' },
        { status: 400 }
    );
    }

    const tags = tagType === 'TECH'
      ? await prisma.techTag.findMany({
          select: {
              id: true,
              name: true,
              description: true,
              _count: {
                  select: {
                      projects: true
                  }
              }
          },
          orderBy: {
              projects: {
                  _count: 'desc'
              }
          }
        })
      : await prisma.domainTag.findMany({
          select: {
              id: true,
              name: true,
              description: true,
              _count: {
                  select: {
                      projects: true
                  }
              }
          },
          orderBy: {
              projects: {
                  _count: 'desc'
              }
          }
        });

    return NextResponse.json(tags);
    } catch (error) {
    console.error('Error fetching tags:', error);
    return NextResponse.json(
    { error: 'Failed to fetch tags' },
    { status: 500 }
    );
    }
}

export async function POST(
    request: Request,
    { params }: { params: { type: string } }
) {
    try {
        const tagType = params.type.toUpperCase();
        if (!['TECH', 'DOMAIN'].includes(tagType)) {
            return NextResponse.json(
                { error: 'Invalid tag type' },
                { status: 400 }
            );
        }

        const body = await request.json();
        const { name, description } = body;

        if (!name) {
            return NextResponse.json(
                { error: 'Name is required' },
                { status: 400 }
            );
        }

        const newTag = tagType === 'TECH'
          ? await prisma.techTag.create({
              data: { name, description }
            })
          : await prisma.domainTag.create({
              data: { name, description }
            });

        return NextResponse.json(newTag, { status: 201 });
    } catch (error) {
        console.error('Error creating tag:', error);
        return NextResponse.json(
            { error: 'Failed to create tag' },
            { status: 500 }
        );
    }
} 