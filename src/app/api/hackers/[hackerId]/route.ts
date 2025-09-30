import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";

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
            likes: true,
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
                likes: true,
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
      return NextResponse.json({ error: "Builder not found" }, { status: 404 });
    }

    const transformedHacker = {
      ...hacker,
      likedProjects: hacker.likes.map((like) => ({
        createdAt: like.createdAt,
        project: like.project,
      })),
    };

    if (transformedHacker.likes) {
      delete (transformedHacker as any).likes;
    }

    return NextResponse.json(transformedHacker);
  } catch (error) {
    console.error("Error fetching hacker:", error);
    return NextResponse.json(
      { error: "Error fetching hacker" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { hackerId: string } }
) {
  try {
    const { userId } = auth();
    if (!userId) {
      return NextResponse.json("Unauthorized", { status: 401 });
    }

    // Get the hacker making the request
    const requestingHacker = await prisma.hacker.findUnique({
      where: { clerkId: userId },
    });

    if (!requestingHacker) {
      return NextResponse.json({ error: "Builder not found" }, { status: 404 });
    }

    // Check if the hacker is updating their own profile
    if (requestingHacker.id !== params.hackerId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await request.json();
    const allowedFields = [
      "name",
      "bio",
      "githubUrl",
      "phoneNumber",
      "linkedinUrl",
      "twitterUrl",
      "username",
      "discordName",
      "websiteUrl"
    ];

    // Filter out any fields that aren't allowed to be updated
    const sanitizedData = Object.keys(data).reduce((acc, key) => {
      if (allowedFields.includes(key)) {
        acc[key] = data[key];
      }
      return acc;
    }, {} as Record<string, any>);

    const updatedHacker = await prisma.hacker.update({
      where: { id: params.hackerId },
      data: sanitizedData,
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

    return NextResponse.json(updatedHacker);
  } catch (error) {
    console.error("Error updating builder:", error);
    return NextResponse.json(
      { error: "Error updating builder" },
      { status: 500 }
    );
  }
}
