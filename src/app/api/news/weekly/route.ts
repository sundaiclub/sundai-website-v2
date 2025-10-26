import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { calculateProjectScore } from '@/lib/trending';

// Mirror client-side TrendingSections -> sortByThisWeekTrending logic
// Uses time-decayed like score with timeDecayDays = 1 and a 14-day window.
const calculateProjectTrendingScore = (project: any) => calculateProjectScore(project, { timeDecayDays: 1 });

export async function GET() {
  try {
    const isResearchSite = process.env.IS_RESEARCH_SITE === 'true';
    const hack_type = isResearchSite ? 'RESEARCH' : 'REGULAR';

    // Fetch ALL approved projects for the hack type; we'll apply a 14-day window on startDate
    const projects = await prisma.project.findMany({
      where: {
        AND: [
          { status: 'APPROVED' as any },
          { hack_type: hack_type as any },
        ],
      },
      include: {
        thumbnail: { select: { url: true, alt: true } },
        launchLead: true,
        participants: { include: { hacker: true } },
        likes: { select: { hackerId: true, createdAt: true } },
        techTags: true,
        domainTags: true,
      },
    });

    // Build the same set as TrendingSections' "Hot This Week": last 14 days, fill if < 5
    const now = new Date();
    const cutoffDate = new Date(now);
    cutoffDate.setDate(now.getDate() - 7);
    cutoffDate.setHours(0, 0, 0, 0);

    const inCutoffDate = projects.filter((p) => {
      const startOrCreated = new Date((p.startDate as any) || (p.createdAt as any));
      return startOrCreated >= cutoffDate;
    });

    const byTrending = (a: any, b: any) => calculateProjectTrendingScore(b) - calculateProjectTrendingScore(a);

    const trendingThisWeek = inCutoffDate.length >= 5
      ? inCutoffDate.sort(byTrending).slice(0, 5)
      : [
          ...inCutoffDate.sort(byTrending),
          ...projects
            .filter((p) => !inCutoffDate.includes(p))
            .sort(byTrending)
            .slice(0, 5 - inCutoffDate.length),
        ];

    const result = trendingThisWeek.map((p) => ({
      id: p.id,
      title: p.title,
      preview: p.preview || p.title,
      createdAt: (p.createdAt instanceof Date ? p.createdAt : new Date(p.createdAt as any)).toISOString(),
      likeCount: p.likes.length,
      thumbnailUrl: p.thumbnail?.url || null,
      launchLead: {
        id: p.launchLead.id,
        name: p.launchLead.name,
        linkedinUrl: (p.launchLead as any).linkedinUrl || null,
        twitterUrl: (p.launchLead as any).twitterUrl || null,
      },
      team: p.participants.map((pp) => ({
        id: pp.hacker.id,
        name: pp.hacker.name,
        linkedinUrl: (pp.hacker as any).linkedinUrl || null,
        twitterUrl: (pp.hacker as any).twitterUrl || null,
      })),
      projectUrl: `https://www.sundai.club/projects/${p.id}`,
    }));

    return NextResponse.json({ topProjects: result });
  } catch (error) {
    console.error("[NEWS_WEEKLY]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}


