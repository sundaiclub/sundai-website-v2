import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    // Determine hack_type based on environment to match existing filters
    const isResearchSite = process.env.IS_RESEARCH_SITE === 'true';
    const hack_type = isResearchSite ? 'RESEARCH' : 'REGULAR';

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const projects = await prisma.project.findMany({
      where: {
        AND: [
          { status: 'APPROVED' as any },
          { hack_type: hack_type as any },
          { createdAt: { gte: sevenDaysAgo } },
        ],
      },
      include: {
        thumbnail: {
          select: { url: true, alt: true },
        },
        launchLead: true,
        participants: { include: { hacker: true } },
        likes: { select: { hackerId: true, createdAt: true } },
        techTags: true,
        domainTags: true,
      },
    });

    const sorted = projects
      .map((p) => ({
        ...p,
        likeCount: p.likes.length,
      }))
      .sort((a, b) => b.likeCount - a.likeCount || (b.createdAt as any) - (a.createdAt as any))
      .slice(0, 5)
      .map((p) => ({
        id: p.id,
        title: p.title,
        preview: p.preview || p.title,
        createdAt: p.createdAt.toISOString(),
        likeCount: p.likeCount,
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

    return NextResponse.json({ topProjects: sorted });
  } catch (error) {
    console.error("[NEWS_WEEKLY]", error);
    return new NextResponse("Internal Error", { status: 500 });
  }
}


