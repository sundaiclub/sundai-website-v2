const { PrismaClient, Role, ProjectStatus } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
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
        name: "Artem Lukoianov",
        clerkId: "user_2ZFr4N2Zv8gzWH",
        role: Role.ADMIN,
        bio: "Co-founder of Sundai Club",
        email: "artem@sundai.club",
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

  // Projects data with titles and descriptions
  const projectsData = [
    {
      title: "AI Startup Map",
      description:
        "Interactive visualization platform mapping the global AI startup ecosystem.",
      status: ProjectStatus.APPROVED,
    },
    {
      title: "Dater Debater",
      description:
        "Dating app that matches users based on their debate skills.",
      status: ProjectStatus.APPROVED,
    },
    {
      title: "Sundai Roast",
      description:
        "AI-powered code review platform with constructive criticism.",
      status: ProjectStatus.APPROVED,
    },
  ];

  // Function to get random users for participants
  const getRandomParticipants = (leaderId: string, count: number) => {
    const availableUsers = users.filter((user) => user.id !== leaderId);
    const shuffled = [...availableUsers].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
  };

  // Create projects with random leads and participants, linked to the week
  for (const projectData of projectsData) {
    const launchLead = users[Math.floor(Math.random() * users.length)];
    const participantCount = Math.floor(Math.random() * 3) + 2; // 2 to 4 participants
    const participants = getRandomParticipants(launchLead.id, participantCount);

    await prisma.project.create({
      data: {
        ...projectData,
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
      },
    });
  }

  // Create some attendance records
  for (const user of users) {
    await prisma.attendance.create({
      data: {
        hackerId: user.id,
        weekId: currentWeek.id,
        date: new Date(),
        checkInTime: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        checkOutTime: new Date(),
        duration: 120, // 2 hours in minutes
        location: "Remote",
        verified: true,
        verifierId: connor.id, // Connor verifies all attendance
      },
    });

    // Update user's total minutes
    await prisma.hacker.update({
      where: { id: user.id },
      data: {
        totalMinutesAttended: 120,
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
