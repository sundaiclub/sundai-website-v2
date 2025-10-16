export const runtime = 'nodejs'
export const maxDuration = 60

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { generateShareContent } from "@/lib/shareContent";

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
    const projectData = {
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

    const acceptHeader = req.headers.get('accept') || '';
    const wantsStream = acceptHeader.includes('text/event-stream') || acceptHeader.includes('text/plain');

    if (wantsStream) {
      const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
      if (!apiKey) {
        return new NextResponse("Gemini API key not configured", { status: 500 });
      }

      const teamMembers = [projectData.launchLead, ...projectData.participants.map((p: any) => p.hacker)];
      const formatTeamNames = (members: any[], plat: string) => {
        const mapOne = (person: any) => {
          switch (plat) {
            case 'twitter': {
              if (person.twitterUrl) {
                const m = person.twitterUrl.match(/(?:twitter\.com|x\.com)\/([^/?]+)/);
                return m ? `@${m[1]}` : `@${String(person.name).split(' ')[0].toLowerCase()}`;
              }
              return `@${String(person.name).split(' ')[0].toLowerCase()}`;
            }
            case 'linkedin': {
              if (person.linkedinUrl) {
                const m = person.linkedinUrl.match(/linkedin\.com\/in\/([^/?]+)/);
                return m ? `@${m[1]}` : `@${String(person.name).toLowerCase().replace(/\s+/g, '-')}`;
              }
              return `@${String(person.name).toLowerCase().replace(/\s+/g, '-')}`;
            }
            case 'reddit':
              return `u/${String(person.name).split(' ')[0].toLowerCase()}`;
            default:
              return String(person.name);
          }
        };
        return members.map(mapOne).join(', ');
      };

      const formattedTeamNames = formatTeamNames(teamMembers, platform);
      const perspective = isTeamMember ? "first-person as a team member" : "third-person promoting Sundai";
      const characterLimit = platform === 'twitter' ? 280 : platform === 'linkedin' ? 3000 : 40000;
      const style = platform === 'twitter' ? "concise, engaging, with relevant emojis and hashtags" : platform === 'linkedin' ? "professional, detailed, focusing on technical achievements and team collaboration" : "informative, community-focused, with technical details that would interest developers";

      const prompt = `Generate a viral social media post for ${platform} about this project:

Project: ${projectData.title}
Description: ${projectData.preview}
Full Description: ${projectData.description}
Team: ${teamMembers.map((p: any) => p.name).join(', ')}
Launch Lead: ${projectData.launchLead.name}

Platform-specific tagging for ${platform}:
${platform === 'linkedin' ? '- Tag people with their actual @username from LinkedIn profiles' : ''}
${platform === 'twitter' ? '- Tag people with their actual @username from Twitter profiles' : ''}
${platform === 'reddit' ? '- Tag people with u/username format, avoid hashtags' : ''}
Formatted team tags (with real social handles): ${formattedTeamNames}

Links available:
${projectData.demoUrl ? `- Demo: ${projectData.demoUrl}` : ''}
${projectData.githubUrl ? `- GitHub: ${projectData.githubUrl}` : ''}
${projectData.blogUrl ? `- Blog: ${projectData.blogUrl}` : ''}
- Project Page: https://www.sundai.club/projects/${projectData.id}

Write from ${perspective}. Style should be ${style}.

Requirements:
- ${isTeamMember ? 'Start with "We just built..." or similar first-person language' : 'Mention "The team at Sundai built..." to promote Sundai'}
- Keep under ${characterLimit} characters
- Include relevant emojis
- Use the real social handles: ${formattedTeamNames}
- ${platform === 'reddit' ? 'Avoid hashtags, use plain text' : 'Add appropriate hashtags'}
- Include team member names with their actual social handles when available
- Mention the links including the project page
- Make it engaging and viral-worthy
- End with link to https://www.sundai.club/projects for more projects

Make there is no fluff, keep it concise, professional and to the point, avoid emojis.
Generate only the post content, no explanations.`;

      const { GoogleGenAI } = await import("@google/genai");
      const ai = new GoogleGenAI({ apiKey });
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        async start(controller) {
          try {
            const response: any = await ai.models.generateContentStream({
              model: "gemini-2.5-flash",
              contents: prompt,
            });
            for await (const chunk of response as any) {
              const text = (chunk && (chunk.text as any)) || '';
              if (text) controller.enqueue(encoder.encode(text));
            }
            controller.close();
          } catch (e) {
            console.error('[SHARE_STREAM]', e);
            controller.close();
          }
        }
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-cache',
        }
      });
    }

    const shareContent = await generateShareContent({
      project: projectData as any, // Type assertion to bypass strict typing
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