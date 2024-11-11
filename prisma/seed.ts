const { PrismaClient, Role, ProjectStatus } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  // Clean up existing data
  await prisma.attendance.deleteMany({});
  await prisma.projectToParticipant.deleteMany({});
  await prisma.projectLike.deleteMany({});
  await prisma.domainTag.deleteMany({});
  await prisma.techTag.deleteMany({});
  await prisma.project.deleteMany({});
  await prisma.hacker.deleteMany({});
  await prisma.week.deleteMany({});

  // First, create a week for the projects
  const currentWeek = await prisma.week.create({
    data: {
      number: 1,
      startDate: new Date("2024-03-01"),
      endDate: new Date("2024-03-07"),
      theme: "AI & Innovation",
      description: "Exploring cutting-edge AI applications",
    },
  });

  // Create base users with clerkId instead of discordId
  const users = await Promise.all([
    prisma.hacker.create({
      data: {
        name: "Connor Dirks",
        clerkId: "user_2ZFr1K9Xt5dxWE", // Example Clerk IDs - replace with real ones
        role: Role.ADMIN,
        bio: "Founder of Sundai Club",
        email: "connor@sundai.club",
      },
    }),
    prisma.hacker.create({
      data: {
        name: "Sam Poder",
        clerkId: "user_2ZFr2L0Yt6exWF",
        role: Role.ADMIN,
        bio: "Co-founder of Sundai Club",
        email: "sam@sundai.club",
      },
    }),
    prisma.hacker.create({
      data: {
        name: "Serge Vasylechko",
        clerkId: "user_2ZFr3M1Zu7fyWG",
        role: Role.ADMIN,
        bio: "Co-founder of Sundai Club",
        email: "serge@sundai.club",
      },
    }),
    prisma.hacker.create({
      data: {
        name: "Test Test",
        clerkId: "user_2og1beYmNP8ttLWbsQZqwb2N0SL",
        role: Role.HACKER,
        bio: "Hacker at Sundai Club",
        email: "kandibober.lukoianov@gmail.com",
      },
    }),
    prisma.hacker.create({
      data: {
        name: "Artem Lukoianov",
        clerkId: "user_2ofxmoR332yWzg1GnquHX1h8Zpu",
        role: Role.ADMIN,
        bio: "Co-founder of Sundai Club",
        email: "lukartoil@gmail.com",
      },
    }),
    prisma.hacker.create({
      data: {
        name: "Vlad Duda",
        clerkId: "user_2ZFr5P3Zw9hAWI",
        role: Role.HACKER,
        bio: "Full Stack Developer",
        email: "vlad@sundai.club",
      },
    }),
  ]);

  const [connor, sam, serge, artem, vlad] = users;

  // Projects data with titles, descriptions, and tags
  const projectsData = [
    {
      title: "AI Startup Map",
      preview: "Interactive visualization platform mapping the global AI startup ecosystem.",
      description:
        "An innovative platform that provides a comprehensive, interactive visualization of the global AI startup landscape.\
        Users can explore startups by industry vertical, funding stage, technology stack, and geographical location\
        The platform features real-time updates, detailed company profiles, funding history, and key metrics.\
        It helps investors, entrepreneurs, and researchers understand market trends, identify potential partnerships, \
        and track the evolution of AI innovation across different sectors and regions.",
      status: ProjectStatus.APPROVED,
      is_starred: true,
      domainTags: ["business", "analytics", "visualization"],
      techTags: ["llms", "rags", "data-visualization"],
    },
    {
      title: "Dater Debater",
      preview: "Dating app that matches users based on their debate skills and argumentative compatibility.",
      description:
        "A revolutionary dating platform that matches users based on their debate skills and intellectual compatibility.\
        Users engage in structured debates on various topics, from philosophy to pop culture, while an AI system analyzes\
        their argumentation style, logical consistency, and emotional intelligence. The app features real-time debate rooms,\
        topic-based matchmaking, and a unique scoring system that considers both debate performance and conversational chemistry.\
        Perfect for intellectuals who believe that the best relationships are built on engaging discussions and respectful disagreements.",
      status: ProjectStatus.APPROVED,
      is_starred: true,
      domainTags: ["social", "dating", "education"],
      techTags: ["llms", "nlp", "matching-algorithms"],
    },
    {
      title: "Sundai Roast",
      preview: "AI-powered code review platform that provides constructive criticism and improvement suggestions.",
      description:
        "An advanced AI-powered code review platform that revolutionizes the way developers receive feedback on their code.\
        The system analyzes code quality, patterns, and potential improvements using state-of-the-art language models.\
        Features include detailed explanations of suggested improvements, performance optimization tips, security vulnerability detection,\
        and best practice recommendations. The platform also provides interactive learning resources, allowing developers to understand\
        the reasoning behind each suggestion. With its unique 'roast' style, it delivers feedback in an engaging and memorable way,\
        while maintaining professionalism and educational value. Perfect for both individual developers looking to improve their skills\
        and teams wanting to maintain high code quality standards.",
      status: ProjectStatus.APPROVED,
      is_starred: true,
      domainTags: ["developer-tools", "education"],
      techTags: ["llms", "code-analysis", "rags"],
    },
    {
      title: "Clip Cut",
      preview: "Interactive visualization platform mapping the global AI startup ecosystem.",
      description:
        "An innovative platform that provides a comprehensive, interactive visualization of the global AI startup landscape.\
        Users can explore startups by industry vertical, funding stage, technology stack, and geographical location\
        The platform features real-time updates, detailed company profiles, funding history, and key metrics.\
        It helps investors, entrepreneurs, and researchers understand market trends, identify potential partnerships, \
        and track the evolution of AI innovation across different sectors and regions.",
      status: ProjectStatus.APPROVED,
      domainTags: ["business", "analytics", "visualization"],
      techTags: ["llms", "rags", "data-visualization"],
    },
    {
      title: "Sundai Travel",
      preview: "Interactive visualization platform mapping the global AI startup ecosystem.",
      description:
        "An innovative platform that provides a comprehensive, interactive visualization of the global AI startup landscape.\
        Users can explore startups by industry vertical, funding stage, technology stack, and geographical location\
        The platform features real-time updates, detailed company profiles, funding history, and key metrics.\
        It helps investors, entrepreneurs, and researchers understand market trends, identify potential partnerships, \
        and track the evolution of AI innovation across different sectors and regions.",
      status: ProjectStatus.PENDING,
      domainTags: ["business", "analytics", "visualization"],
      techTags: ["llms", "rags", "data-visualization"],
    },
    {
      title: "TikTok to Arxiv",
      preview: "Interactive visualization platform mapping the global AI startup ecosystem.",
      description:
        "An innovative platform that provides a comprehensive, interactive visualization of the global AI startup landscape.\
        Users can explore startups by industry vertical, funding stage, technology stack, and geographical location\
        The platform features real-time updates, detailed company profiles, funding history, and key metrics.\
        It helps investors, entrepreneurs, and researchers understand market trends, identify potential partnerships, \
        and track the evolution of AI innovation across different sectors and regions.",
      status: ProjectStatus.DRAFT,
      domainTags: ["business", "analytics", "visualization"],
      techTags: ["llms", "rags", "data-visualization"],
    },
  ];

  // Function to get random users for participants
  const getRandomParticipants = (leaderId: string, count: number) => {
    const availableUsers = users.filter((user) => user.id !== leaderId);
    const shuffled = [...availableUsers].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  };

  // Create projects with random leads, participants, and tags
  for (const projectData of projectsData) {
    const { domainTags, techTags, ...projectDataWithoutTags } = projectData;
    const launchLead = users[Math.floor(Math.random() * users.length)];
    const participantCount = Math.floor(Math.random() * 3) + 2;
    const participants = getRandomParticipants(launchLead.id, participantCount);

    // Clean up any existing tags with the same names
    for (const tag of domainTags) {
      await prisma.domainTag.deleteMany({ where: { name: tag } });
    }
    for (const tag of techTags) {
      await prisma.techTag.deleteMany({ where: { name: tag } });
    }

    await prisma.project.create({
      data: {
        ...projectDataWithoutTags,
        launchLeadId: launchLead.id,
        weeks: {
          connect: {
            id: currentWeek.id,
          },
        },
        participants: {
          create: participants.map((participant) => ({
            hackerId: participant.id,
            role: ["DEVELOPER", "DESIGNER", "PM"][
              Math.floor(Math.random() * 3)
            ],
          })),
        },
        likes: {
          create: users
            .filter(() => Math.random() > 0.5)
            .map((user) => ({
              hackerId: user.id,
            })),
        },
        domainTags: {
          create: domainTags.map((tag) => ({
            name: tag,
          })),
        },
        techTags: {
          create: techTags.map((tag) => ({
            name: tag,
          })),
        },
      },
    });
  }

  // Create some attendance records
  for (const user of users) {
    await prisma.attendance.create({
      data: {
        hackerId: user.id,
        weekId: currentWeek.id,
        timestamp: new Date(),
        status: "PRESENT",
        verifierId: connor.id, // Optional now, but we'll keep Connor as verifier
      },
    });

    // Remove this update since we no longer track totalMinutesAttended
    await prisma.hacker.update({
      where: { id: user.id },
      data: {
        lastAttendance: new Date(),
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
