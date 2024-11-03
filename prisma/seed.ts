const { PrismaClient, Role, ProjectStatus } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  // Create base users
  const users = await Promise.all([
    prisma.hacker.create({
      data: {
        name: "Connor Dirks",
        discordId: "connor_discord_id",
        role: Role.ADMIN,
        bio: "Full Stack Developer at Sundai Club",
        email: "connor@sundai.club",
      },
    }),
    prisma.hacker.create({
      data: {
        name: "Sam Poder",
        discordId: "sam_discord_id",
        role: Role.ADMIN,
        bio: "Co-founder of Sundai Club",
        email: "sam@sundai.club",
      },
    }),
    prisma.hacker.create({
      data: {
        name: "Serge Vasylechko",
        discordId: "serge_discord_id",
        role: Role.ADMIN,
        bio: "Co-founder of Sundai Club",
        email: "serge@sundai.club",
      },
    }),
    prisma.hacker.create({
      data: {
        name: "Artem Lukoianov",
        discordId: "artem_discord_id",
        role: Role.ADMIN,
        bio: "Co-founder of Sundai Club",
        email: "artem@sundai.club",
      },
    }),
    prisma.hacker.create({
      data: {
        name: "Vlad Duda",
        discordId: "vlad_discord_id",
        role: Role.HACKER,
        bio: "Full Stack Developer",
        email: "vlad@sundai.club",
      },
    }),
    prisma.hacker.create({
      data: {
        name: "Nik Blal",
        discordId: "nik_discord_id",
        role: Role.HACKER,
        bio: "AI Engineer",
        email: "nik@sundai.club",
      },
    }),
    prisma.hacker.create({
      data: {
        name: "Sainesh Nakra",
        discordId: "sainesh_discord_id",
        role: Role.HACKER,
        bio: "Frontend Developer",
        email: "sainesh@sundai.club",
      },
    }),
  ]);

  const [sam, serge, artem, vlad, sainesh] = users;

  // Projects data with titles and descriptions
  const projectsData = [
    {
      title: "AI Startup Map",
      description:
        "Interactive visualization platform mapping the global AI startup ecosystem, tracking funding, technology focus, and market trends.",
      status: ProjectStatus.APPROVED,
    },
    {
      title: "Dater Debater",
      description:
        "Dating app that matches users based on their debate skills and intellectual compatibility, featuring AI-moderated discussions.",
      status: ProjectStatus.APPROVED,
    },
    {
      title: "Sundai Roast",
      description:
        "AI-powered code review platform that provides constructive criticism and improvement suggestions with a touch of humor.",
      status: ProjectStatus.APPROVED,
    },
    {
      title: "Hack Clips",
      description:
        "Platform for sharing and discovering short-form programming tutorials and coding tips, with AI-enhanced search and recommendations.",
      status: ProjectStatus.APPROVED,
    },
    {
      title: "Kiwi",
      description:
        "AI productivity assistant that helps developers manage tasks, schedule meetings, and optimize their workflow.",
      status: ProjectStatus.APPROVED,
    },
    {
      title: "User Access LLM",
      description:
        "Integration platform that simplifies the process of adding LLM-powered features to user authentication systems.",
      status: ProjectStatus.APPROVED,
    },
    {
      title: "Landing Page Generator",
      description:
        "AI tool that creates optimized landing pages based on business requirements and target audience analysis.",
      status: ProjectStatus.APPROVED,
    },
    {
      title: "Ukraine Kids Project",
      description:
        "Educational platform providing accessible learning resources and support for children affected by the conflict in Ukraine.",
      status: ProjectStatus.APPROVED,
    },
    {
      title: "Attention Retention",
      description:
        "AI-powered content optimization tool that analyzes and improves user engagement metrics across digital platforms.",
      status: ProjectStatus.APPROVED,
    },
    {
      title: "Launchr",
      description:
        "AI interview preparation platform that simulates realistic job interviews and provides personalized feedback.",
      status: ProjectStatus.APPROVED,
    },
    {
      title: "One Router",
      description:
        "Universal API routing solution that simplifies backend integration and microservices communication.",
      status: ProjectStatus.APPROVED,
    },
    {
      title: "Script",
      description:
        "AI-assisted screenwriting tool that helps writers develop and refine their stories with intelligent suggestions.",
      status: ProjectStatus.APPROVED,
    },
    {
      title: "Cairo",
      description:
        "Smart city planning and visualization platform using AI to optimize urban development and sustainability.",
      status: ProjectStatus.APPROVED,
    },
  ];

  // Function to get random users for participants
  const getRandomParticipants = (leaderId: string, count: number) => {
    const availableUsers = users.filter((user) => user.id !== leaderId);
    const shuffled = [...availableUsers].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  };

  // Create projects with random leads and participants
  for (const projectData of projectsData) {
    // Randomly select a launch lead
    const launchLead = users[Math.floor(Math.random() * users.length)];

    // Get 2-4 random participants
    const participantCount = Math.floor(Math.random() * 3) + 2; // 2 to 4 participants
    const participants = getRandomParticipants(launchLead.id, participantCount);

    // Create the project
    await prisma.project.create({
      data: {
        ...projectData,
        launchLeadId: launchLead.id,
        participants: {
          create: participants.map((participant) => ({
            hackerId: participant.id,
            role: ["DEVELOPER", "DESIGNER", "PM"][
              Math.floor(Math.random() * 3)
            ],
          })),
        },
        // Add some random likes
        likes: {
          create: users
            .filter(() => Math.random() > 0.5) // 50% chance for each user to like
            .map((user) => ({
              hackerId: user.id,
            })),
        },
      },
    });
  }

  console.log("Seed data created successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
