// src/app/api/projects/trending/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { calculateProjectScore } from "@/lib/trending";

function getProjectsByDateRange<T extends { createdAt: Date }>(
  projects: T[],
  daysBack: number
): T[] {
  const now = new Date();
  const startDate = new Date(now);
  startDate.setDate(now.getDate() - daysBack);
  startDate.setHours(0, 0, 0, 0);

  return projects.filter((project) => {
    return project.createdAt >= startDate;
  });
}

function getThisWeekProjects<T extends { createdAt: Date }>(projects: T[]): T[] {
  return getProjectsByDateRange(projects, 7);
}

function getThisMonthProjects<T extends { createdAt: Date }>(projects: T[]): T[] {
  const now = new Date();
  const twoMonthsAgo = new Date(now);
  twoMonthsAgo.setMonth(now.getMonth() - 2);
  twoMonthsAgo.setDate(1);
  twoMonthsAgo.setHours(0, 0, 0, 0);

  return projects.filter((project) => {
    return project.createdAt >= twoMonthsAgo;
  });
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const range = searchParams.get("range") || "week";
    const limit = Number(searchParams.get("limit") || "5");

    const projects = await prisma.project.findMany({
      where: { status: "APPROVED" },
      include: {
        likes: true,
        techTags: true,
        domainTags: true,
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
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 250,
    });

    let source: typeof projects = projects;
    let timeDecayDays: number | undefined;

    if (range === "week") {
      source = getThisWeekProjects(projects);
      timeDecayDays = 1; // you used 1 in frontend
    } else if (range === "month") {
      source = getThisMonthProjects(projects);
      timeDecayDays = 20; // you used 20 in frontend
    } else {
      // all time
      source = projects;
      timeDecayDays = undefined;
    }

    // if not enough in range, fall back to the rest (like you did on FE)
    if (range === "week" && source.length < limit) {
      const missing = limit - source.length;
      const rest = projects.filter((p) => !source.find((s) => s.id === p.id));
      const merged = [
        ...source,
        ...rest.slice(0, Math.max(missing, 0)),
      ];

      const sortedMerged = merged
        .map((p) => ({
          project: p,
          score: calculateProjectScore(p as any, { timeDecayDays }),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((x) => x.project);

      return NextResponse.json(sortedMerged);
    }

    // normal case: sort and slice
    const sorted = source
      .map((p) => ({
        project: p,
        score: calculateProjectScore(p as any, { timeDecayDays }),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((x) => x.project);

    return NextResponse.json(sorted);
  } catch (err) {
    console.error("Error in /api/projects/trending:", err);
    return NextResponse.json(
      { error: "Failed to fetch trending projects" },
      { status: 500 }
    );
  }
}
