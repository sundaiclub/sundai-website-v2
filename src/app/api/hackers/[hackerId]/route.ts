import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";

export async function GET(
  req: Request,
  { params }: { params: { hackerId: string } }
) {
  try {
    const hacker = await prisma.hacker.findUnique({
      where: { id: params.hackerId },
      include: {
        avatar: true,
        // Get submissions where they are the launch lead
        ledSubmissions: {
          include: {
            thumbnail: true,
            launchLead: {
              include: {
                avatar: true,
              },
            },
            participants: {
              include: {
                hacker: {
                  include: {
                    avatar: true,
                  },
                },
              },
            },
            likes: true,
          },
        },
        // Get submissions where they are a participant
        submissionParticipations: {
          include: {
            submission: {
              include: {
                thumbnail: true,
                launchLead: {
                  include: {
                    avatar: true,
                  },
                },
                participants: {
                  include: {
                    hacker: {
                      include: {
                        avatar: true,
                      },
                    },
                  },
                },
                likes: true,
              },
            },
          },
        },
      },
    });

    if (!hacker) {
      return new NextResponse("Hacker not found", { status: 404 });
    }

    return NextResponse.json(hacker);
  } catch (error) {
    console.error("[HACKER_GET]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { hackerId: string } }
) {
  try {
    const { userId } = auth();
    if (!userId) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    // Get the hacker making the request
    const requestingHacker = await prisma.hacker.findUnique({
      where: { clerkId: userId },
    });

    if (!requestingHacker) {
      return new NextResponse("Hacker not found", { status: 404 });
    }

    // Check if the hacker is updating their own profile
    if (requestingHacker.id !== params.hackerId) {
      return new NextResponse("Unauthorized", { status: 401 });
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
      "websiteUrl",
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
        ledSubmissions: {
          include: {
            thumbnail: true,
            launchLead: {
              include: {
                avatar: true,
              },
            },
          },
        },
        submissionParticipations: {
          include: {
            submission: {
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
