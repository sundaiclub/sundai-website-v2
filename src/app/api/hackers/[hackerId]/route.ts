import { PrismaClient } from "@prisma/client";
import { NextResponse } from "next/server";

const prisma = new PrismaClient();

export async function GET(
  request: Request,
  { params }: { params: { hackerId: string } }
) {
  try {
    const hacker = await prisma.hacker.findUnique({
      where: { id: params.hackerId },
      include: {
        avatar: true,
        ledProjects: {
          include: {
            thumbnail: true,
          },
          orderBy: {
            createdAt: "desc",
          },
        },
        projects: {
          include: {
            project: {
              include: {
                thumbnail: true,
                likes: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        },
        likes: {
          include: {
            project: {
              include: {
                thumbnail: true,
                launchLead: {
                  include: {
                    avatar: true,
                  },
                },
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    if (!hacker) {
      return NextResponse.json({ error: "Hacker not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: hacker.id,
      name: hacker.name,
      bio: hacker.bio,
      email: hacker.email,
      githubUrl: hacker.githubUrl,
      phoneNumber: hacker.phoneNumber,
      role: hacker.role,
      avatar: hacker.avatar
        ? {
            url: hacker.avatar.url,
          }
        : null,
      ledProjects: hacker.ledProjects.map((project) => ({
        id: project.id,
        title: project.title,
        description: project.description,
        status: project.status,
        thumbnail: project.thumbnail
          ? {
              url: project.thumbnail.url,
            }
          : null,
      })),
      projects: hacker.projects.map((participation) => ({
        role: participation.role,
        project: {
          id: participation.project.id,
          title: participation.project.title,
          description: participation.project.description,
          status: participation.project.status,
          thumbnail: participation.project.thumbnail
            ? {
                url: participation.project.thumbnail.url,
              }
            : null,
          likes: participation.project.likes,
        },
      })),
      likedProjects: hacker.likes.map((like) => ({
        createdAt: like.createdAt,
        project: {
          id: like.project.id,
          title: like.project.title,
          description: like.project.description,
          status: like.project.status,
          thumbnail: like.project.thumbnail
            ? {
                url: like.project.thumbnail.url,
              }
            : null,
          launchLead: {
            name: like.project.launchLead.name,
            avatar: like.project.launchLead.avatar
              ? {
                  url: like.project.launchLead.avatar.url,
                }
              : null,
          },
        },
      })),
    });
  } catch (error) {
    console.error("Error fetching hacker:", error);
    return NextResponse.json(
      { error: "Error fetching hacker" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { hackerId: string } }
) {
  try {
    const data = await request.json();
    const updatedHacker = await prisma.hacker.update({
      where: { id: params.hackerId },
      data,
      include: {
        avatar: true,
        ledProjects: {
          include: {
            thumbnail: true,
          },
        },
        projects: {
          include: {
            project: {
              include: {
                thumbnail: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json(updatedHacker);
  } catch (error) {
    console.error("Error updating hacker:", error);
    return NextResponse.json(
      { error: "Error updating hacker" },
      { status: 500 }
    );
  }
}
