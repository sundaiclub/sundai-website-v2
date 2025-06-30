import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { generateShareContent, ProjectWithSocials } from "@/lib/shareContent";

export async function POST(
  req: Request,
  { params }: { params: { projectId: string } }
) {
  try {
    const { userId } = auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const body = await req.json();
    const { platform } = body;

    if (!platform || !['twitter', 'linkedin', 'reddit'].includes(platform)) {
      return new NextResponse("Invalid platform", { status: 400 });
    }

    // Get the current user's hacker record
    const currentUser = await prisma.hacker.findUnique({
      where: { clerkId: userId },
    });

    if (!currentUser) {
      return new NextResponse("User not found", { status: 404 });
    }

    // Get the project with all necessary data
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
      return new NextResponse("Project not found", { status: 404 });
    }

    // Check if user is a team member
    const isTeamMember = project.participants.some(p => p.hacker.id === currentUser.id) || 
                        project.launchLeadId === currentUser.id;

    // Generate content using Gemini API
    const projectData: ProjectWithSocials = {
      id: project.id,
      title: project.title,
      preview: project.preview || project.title,
      description: project.description || project.preview || 'No description available',
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

    const shareContent = await generateShareContent({
      project: projectData,
      userInfo: currentUser,
      platform: platform as 'twitter' | 'linkedin' | 'reddit',
      isTeamMember,
    });

    return NextResponse.json(shareContent);
  } catch (error) {
    console.error("[SHARE_CONTENT_GENERATION]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
} 