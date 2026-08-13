export type Project = {
  id: string;
  title: string;
  status: "DRAFT" | "PENDING" | "APPROVED";
  preview: string;
  description: string;
  githubUrl?: string | null;
  demoUrl?: string | null;
  blogUrl?: string | null;
  techTags: Array<{
    id: string;
    name: string;
    description?: string | null;
  }>;
  domainTags: Array<{
    id: string;
    name: string;
    description?: string | null;
  }>;
  is_starred: boolean;
  is_broken: boolean;
  thumbnail?: {
    url: string;
    prompt?: string | null;
  } | null;
  launchLead: {
    id: string;
    name: string;
    twitterUrl?: string | null;
    linkedinUrl?: string | null;
    avatar?: {
      url: string;
    } | null;
  };
  participants: Array<{
    role: string;
    hacker: {
      id: string;
      name: string;
      bio?: string | null;
      twitterUrl?: string | null;
      linkedinUrl?: string | null;
      avatar?: {
        url: string;
      } | null;
    };
  }>;
  startDate: Date;
  endDate?: Date | null;
  likes: Array<{
    hackerId: string;
    createdAt: string;
  }>;
  createdAt: string;
  updatedAt: string;
};
