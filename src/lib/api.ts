// API utility functions for client-side data fetching

export interface Hacker {
  id: string;
  name: string;
  email: string;
  bio?: string;
  github?: string;
  linkedin?: string;
  twitter?: string;
  website?: string;
  avatar?: string;
  skills: string[];
  interests: string[];
  location?: string;
  timezone?: string;
  availability?: string;
  portfolio?: string;
  resume?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Project {
  id: string;
  title: string;
  description?: string;
  status: string;
  isStarred: boolean;
  thumbnail?: string;
  githubUrl?: string;
  demoUrl?: string;
  figmaUrl?: string;
  techTags: string[];
  domainTags: string[];
  launchLead: {
    id: string;
    name: string;
    email: string;
  };
  participants: Array<{
    id: string;
    name: string;
    email: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProjectData {
  title: string;
  description?: string;
  status: string;
  githubUrl?: string;
  demoUrl?: string;
  figmaUrl?: string;
  techTags: string[];
  domainTags: string[];
  launchLeadId: string;
  participantIds: string[];
}

export interface UpdateProjectData {
  title?: string;
  description?: string;
  status?: string;
  isStarred?: boolean;
  githubUrl?: string;
  demoUrl?: string;
  figmaUrl?: string;
  techTags?: string[];
  domainTags?: string[];
  launchLeadId?: string;
  participantIds?: string[];
}

// Hacker API functions
export async function getHacker(hackerId: string): Promise<Hacker | null> {
  try {
    const response = await fetch(`/api/hackers/${hackerId}`);
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error('Failed to fetch hacker');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching hacker:', error);
    throw error;
  }
}

export async function getHackerByClerkId(clerkId: string): Promise<Hacker | null> {
  try {
    const response = await fetch(`/api/hackers/by-clerk-id/${clerkId}`);
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error('Failed to fetch hacker by Clerk ID');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching hacker by Clerk ID:', error);
    throw error;
  }
}

// Project API functions
export async function getProject(projectId: string): Promise<Project | null> {
  try {
    const response = await fetch(`/api/projects/${projectId}`);
    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error('Failed to fetch project');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching project:', error);
    throw error;
  }
}

export async function createProject(data: CreateProjectData): Promise<Project> {
  try {
    const response = await fetch('/api/projects', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error('Failed to create project');
    }

    return await response.json();
  } catch (error) {
    console.error('Error creating project:', error);
    throw error;
  }
}

export async function updateProject(projectId: string, data: UpdateProjectData): Promise<Project> {
  try {
    const response = await fetch(`/api/projects/${projectId}/edit`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new Error('Failed to update project');
    }

    return await response.json();
  } catch (error) {
    console.error('Error updating project:', error);
    throw error;
  }
}
