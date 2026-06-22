import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";

const REQUIRED_HACKER_UPDATE_FIELDS = ["name"] as const;

const NULLABLE_HACKER_UPDATE_FIELDS = [
  "bio",
  "githubUrl",
  "phoneNumber",
  "linkedinUrl",
  "twitterUrl",
  "username",
  "discordName",
  "websiteUrl",
] as const;

const ALLOWED_HACKER_UPDATE_FIELDS = [
  ...REQUIRED_HACKER_UPDATE_FIELDS,
  ...NULLABLE_HACKER_UPDATE_FIELDS,
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

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

    const { likes, ...hackerWithoutLikes } = hacker;
    const transformedHacker = {
      ...hackerWithoutLikes,
      likedProjects: likes.map((like) => ({
        createdAt: like.createdAt,
        project: like.project,
      })),
    };

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

    const data: unknown = await request.json();

    // Filter out any fields that aren't allowed to be updated
    const sanitizedData: Prisma.HackerUpdateInput = {};

    if (isRecord(data)) {
      if (typeof data.name === "string") {
        sanitizedData.name = data.name;
      }

      for (const key of NULLABLE_HACKER_UPDATE_FIELDS) {
        const value = data[key];
        if (typeof value === "string" || value === null) {
          sanitizedData[key] = value;
        }
      }
    }

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
