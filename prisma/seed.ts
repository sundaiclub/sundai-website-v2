const {
  PrismaClient,
  Role,
  ProjectStatus,
  PitchProjectStatus,
  ChapterMembershipRole,
  ChapterMembershipStatus,
  EventStaffRole,
  EventStatus,
  EventVisibility,
  EventApplicationMode,
  EventRegistrationStatus,
  EventRegistrationSource,
  ApplicationTemplateScope,
} = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  // Clean up existing data
  await prisma.eventRegistrationAudit.deleteMany({});
  await prisma.eventRegistration.deleteMany({});
  await prisma.pitchProjectVote.deleteMany({});
  await prisma.pitchProject.deleteMany({});
  await prisma.pitchSession.deleteMany({});
  await prisma.eventStaff.deleteMany({});
  await prisma.event.deleteMany({});
  await prisma.applicationTemplate.deleteMany({});
  await prisma.userBanFlag.deleteMany({});
  await prisma.userBan.deleteMany({});
  await prisma.hackerOrganizerNoteRevision.deleteMany({});
  await prisma.hackerOrganizerNote.deleteMany({});
  await prisma.chapterMembership.deleteMany({});
  await prisma.chapter.deleteMany({});
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
        role: Role.SITE_ADMIN,
        bio: "Founder of Sundai Club",
        email: "connor@sundai.club",
      },
    }),
    prisma.hacker.create({
      data: {
        name: "Sam Poder",
        clerkId: "user_2ZFr2L0Yt6exWF",
        role: Role.SITE_ADMIN,
        bio: "Co-founder of Sundai Club",
        email: "sam@sundai.club",
      },
    }),
    prisma.hacker.create({
      data: {
        name: "Serge Vasylechko",
        clerkId: "user_2ZFr3M1Zu7fyWG",
        role: Role.SITE_ADMIN,
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
        role: Role.SITE_ADMIN,
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
    prisma.hacker.create({
        data: {
        name: "abhishek uddaraju",
        clerkId: "user_31kJ5uvyjnwPqZAXEWmUAY88ZAa",
        role: Role.HACKER,
        bio: "New developer on the team",
        email: "uabhishek2904@gmail.com",
      },
    }),
  ]);

  const [connor, sam, serge, testHacker, artem, vlad, abhishek] = users;

  const bostonChapter = await prisma.chapter.create({
    data: {
      name: "Sundai Boston",
      slug: "boston",
      city: "Boston",
      region: "MA",
      country: "US",
      timezone: "America/New_York",
      description:
        "Boston hackers building and demoing AI projects every Sunday.",
      status: "ACTIVE",
      accessMode: "PUBLIC",
      mailingListName: "Sundai Boston",
      mailingListExternalId: "sundai-boston",
      memberships: {
        create: [connor, sam, serge, artem].map((admin) => ({
          hackerId: admin.id,
          role: ChapterMembershipRole.ADMIN,
          status: ChapterMembershipStatus.ACTIVE,
          joinedAt: new Date(),
          notificationsAllowed: true,
          emailNotificationsEnabled: true,
        })),
      },
    },
  });

  await prisma.applicationTemplate.create({
    data: {
      scope: ApplicationTemplateScope.SITE,
      name: "Default site application",
      fieldsJson: [
        {
          id: "name",
          label: "Name",
          type: "TEXT",
          required: true,
          siteRequired: true,
          order: 1,
        },
        {
          id: "email",
          label: "Email",
          type: "EMAIL",
          required: true,
          siteRequired: true,
          order: 2,
        },
      ],
      isActive: true,
      createdById: connor.id,
    },
  });

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

  // Create sample upcoming Events with MCs, RSVP state, and a queue
  const allProjects = await prisma.project.findMany({});
  const start = new Date();
  start.setMinutes(start.getMinutes() + 60); // starts in 60 minutes
  const workshopStart = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
  const closedEventStart = new Date(start.getTime() + 14 * 24 * 60 * 60 * 1000);
  const sampleEvent = await prisma.event.create({
    data: {
      title: "Sundai Weekly Pitch Night",
      description: "Weekly demos and lightning pitches from the Sundai community.",
      startTime: start,
      endTime: new Date(start.getTime() + 2 * 60 * 60 * 1000),
      chapterId: bostonChapter.id,
      slug: "weekly-pitch-night",
      status: EventStatus.PUBLISHED,
      visibility: EventVisibility.PUBLIC,
      applicationMode: EventApplicationMode.REQUIRES_APPROVAL,
      applicationsOpen: true,
      applicationsClosedAt: null,
      applicationsClosedById: null,
      applicationsCloseReason: null,
      capacity: 40,
      programType: "pitch-night",
      publicProgramLabel: "Pitch Night",
      meetingUrl: "https://zoom.us/j/1234567890",
      location: "Sundai Boston Studio",
      venueName: "Sundai Boston Studio",
      publicLocation: "Hybrid - Boston, MA",
      address: "Approved attendees receive the studio address by email.",
      virtualUrl: "https://zoom.us/j/1234567890",
      approvedDetailsJson: {
        arrivalInstructions:
          "Use the side entrance after 6:00 PM and check in with the MC.",
        virtualJoinUrl: "https://zoom.us/j/1234567890",
        wifi: "Network details are shared at check-in.",
      },
      applicationQuestionsJson: [
        {
          id: "project-summary",
          label: "What are you building or interested in pitching?",
          type: "TEXTAREA",
          required: true,
          order: 10,
        },
      ],
      hideChapterDefaultQuestions: false,
      autoPromoteWaitlist: false,
      createdById: users[0].id,
      staff: {
        create: [
          { hackerId: users[0].id, role: EventStaffRole.MC },
          { hackerId: users[1].id, role: EventStaffRole.MC },
        ],
      },
    },
  });
  const publicWorkshopEvent = await prisma.event.create({
    data: {
      title: "AI Agent Build Workshop",
      description:
        "Hands-on build session for hackers shipping useful AI agents.",
      startTime: workshopStart,
      endTime: new Date(workshopStart.getTime() + 3 * 60 * 60 * 1000),
      chapterId: bostonChapter.id,
      slug: "ai-agent-build-workshop",
      status: EventStatus.PUBLISHED,
      visibility: EventVisibility.PUBLIC,
      applicationMode: EventApplicationMode.OPEN_RSVP,
      applicationsOpen: true,
      applicationsClosedAt: null,
      applicationsClosedById: null,
      applicationsCloseReason: null,
      capacity: 24,
      programType: "workshop",
      publicProgramLabel: "Workshop",
      venueName: "Sundai Boston Studio",
      publicLocation: "Boston, MA",
      address: "Approved attendees receive the studio address by email.",
      approvedDetailsJson: {
        preparation:
          "Bring a laptop with Node.js installed and API keys ready for local development.",
        room: "Workshop Room A",
      },
      applicationQuestionsJson: [
        {
          id: "agent-idea",
          label: "What agent workflow do you want to build?",
          type: "TEXTAREA",
          required: true,
          order: 10,
        },
      ],
      hideChapterDefaultQuestions: false,
      autoPromoteWaitlist: false,
      createdById: connor.id,
      staff: {
        create: [
          { hackerId: connor.id, role: EventStaffRole.MC },
          { hackerId: sam.id, role: EventStaffRole.CO_MC },
        ],
      },
    },
  });
  const closedApplicationsEvent = await prisma.event.create({
    data: {
      title: "Sundai Founder Dinner",
      description:
        "Small-group dinner for builders comparing notes on early AI products.",
      startTime: closedEventStart,
      endTime: new Date(closedEventStart.getTime() + 2 * 60 * 60 * 1000),
      chapterId: bostonChapter.id,
      slug: "founder-dinner",
      status: EventStatus.PUBLISHED,
      visibility: EventVisibility.PUBLIC,
      applicationMode: EventApplicationMode.REQUIRES_APPROVAL,
      applicationsOpen: false,
      applicationsClosedAt: new Date(),
      applicationsClosedById: connor.id,
      applicationsCloseReason: "Applications are full for this dinner.",
      capacity: 12,
      programType: "dinner",
      publicProgramLabel: "Dinner",
      venueName: "Sundai Boston Dinner Venue",
      publicLocation: "Boston, MA",
      address: "Approved attendees receive the restaurant reservation details.",
      approvedDetailsJson: {
        reservationName: "Sundai Boston",
        arrivalInstructions:
          "Ask the host for the Sundai reservation when you arrive.",
      },
      applicationQuestionsJson: [
        {
          id: "current-product",
          label: "What product or company are you working on?",
          type: "TEXTAREA",
          required: true,
          order: 10,
        },
      ],
      hideChapterDefaultQuestions: false,
      autoPromoteWaitlist: false,
      createdById: connor.id,
      staff: {
        create: [{ hackerId: connor.id, role: EventStaffRole.MC }],
      },
    },
  });

  const submittedAt = new Date();
  await prisma.eventRegistration.create({
    data: {
      eventId: sampleEvent.id,
      hackerId: testHacker.id,
      status: EventRegistrationStatus.PENDING,
      source: EventRegistrationSource.WEBSITE,
      submittedAt,
      answersJson: {
        name: testHacker.name,
        email: testHacker.email,
        "project-summary": "I want feedback on a retrieval agent demo.",
      },
      templateSnapshotJson: {
        source: "seed",
        fields: ["name", "email", "project-summary"],
      },
      audits: {
        create: {
          eventId: sampleEvent.id,
          actorId: testHacker.id,
          toStatus: EventRegistrationStatus.PENDING,
          changeJson: {
            action: "PUBLIC_APPLICATION_SUBMITTED",
            source: EventRegistrationSource.WEBSITE,
          },
        },
      },
    },
  });
  await prisma.eventRegistration.create({
    data: {
      eventId: sampleEvent.id,
      hackerId: vlad.id,
      status: EventRegistrationStatus.APPROVED,
      source: EventRegistrationSource.WEBSITE,
      submittedAt,
      decidedById: connor.id,
      decidedAt: new Date(),
      answersJson: {
        name: vlad.name,
        email: vlad.email,
        "project-summary": "I am pitching a full-stack AI debugging tool.",
      },
      templateSnapshotJson: {
        source: "seed",
        fields: ["name", "email", "project-summary"],
      },
      audits: {
        create: [
          {
            eventId: sampleEvent.id,
            actorId: vlad.id,
            toStatus: EventRegistrationStatus.PENDING,
            changeJson: {
              action: "PUBLIC_APPLICATION_SUBMITTED",
              source: EventRegistrationSource.WEBSITE,
            },
          },
          {
            eventId: sampleEvent.id,
            actorId: connor.id,
            fromStatus: EventRegistrationStatus.PENDING,
            toStatus: EventRegistrationStatus.APPROVED,
            changeJson: { action: "APPLICATION_APPROVED" },
          },
        ],
      },
    },
  });
  await prisma.eventRegistration.create({
    data: {
      eventId: publicWorkshopEvent.id,
      hackerId: abhishek.id,
      status: EventRegistrationStatus.WAITLISTED,
      source: EventRegistrationSource.WEBSITE,
      submittedAt,
      waitlistedAt: submittedAt,
      publicSafeMessage:
        "You are on the waitlist. We will email you if a spot opens.",
      answersJson: {
        name: abhishek.name,
        email: abhishek.email,
        "agent-idea": "A support triage agent for project teams.",
      },
      templateSnapshotJson: {
        source: "seed",
        fields: ["name", "email", "agent-idea"],
      },
      audits: {
        create: {
          eventId: publicWorkshopEvent.id,
          actorId: abhishek.id,
          toStatus: EventRegistrationStatus.WAITLISTED,
          changeJson: {
            action: "PUBLIC_RSVP_WAITLISTED",
            source: EventRegistrationSource.WEBSITE,
          },
        },
      },
    },
  });
  await prisma.eventRegistration.create({
    data: {
      eventId: closedApplicationsEvent.id,
      hackerId: vlad.id,
      status: EventRegistrationStatus.CANCELLED,
      source: EventRegistrationSource.WEBSITE,
      submittedAt,
      cancelledAt: new Date(),
      cancelledById: vlad.id,
      answersJson: {
        name: vlad.name,
        email: vlad.email,
        "current-product": "A developer workflow assistant.",
      },
      templateSnapshotJson: {
        source: "seed",
        fields: ["name", "email", "current-product"],
      },
      audits: {
        create: [
          {
            eventId: closedApplicationsEvent.id,
            actorId: vlad.id,
            toStatus: EventRegistrationStatus.PENDING,
            changeJson: {
              action: "PUBLIC_APPLICATION_SUBMITTED",
              source: EventRegistrationSource.WEBSITE,
            },
          },
          {
            eventId: closedApplicationsEvent.id,
            actorId: vlad.id,
            fromStatus: EventRegistrationStatus.PENDING,
            toStatus: EventRegistrationStatus.CANCELLED,
            changeJson: { action: "REGISTRATION_CANCELLED_BY_USER" },
          },
        ],
      },
    },
  });
  const samplePitchSession = await prisma.pitchSession.create({
    data: {
      eventId: sampleEvent.id,
      chapterId: bostonChapter.id,
      title: sampleEvent.title,
      description: sampleEvent.description,
      startTime: sampleEvent.startTime,
      meetingUrl: sampleEvent.meetingUrl,
      location: sampleEvent.location,
      createdById: users[0].id,
      legacyBackfill: false,
      audienceCanReorder: true,
      votingEndTime: new Date(sampleEvent.startTime.getTime() + 15 * 60 * 1000),
    },
  });

  const queueProjects = allProjects.slice(0, Math.min(3, allProjects.length));
  for (let i = 0; i < queueProjects.length; i++) {
    const p = queueProjects[i];
    await prisma.pitchProject.create({
      data: {
        pitchSessionId: samplePitchSession.id,
        projectId: p.id,
        addedById: p.launchLeadId,
        position: i + 1,
        status: PitchProjectStatus.QUEUED,
        approved: i === 0 ? true : false,
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
