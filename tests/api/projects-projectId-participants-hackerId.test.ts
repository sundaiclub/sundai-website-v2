import { NextRequest } from 'next/server';
import { DELETE } from '../../src/app/api/projects/[projectId]/participants/[hackerId]/route';
import prisma from '../../src/lib/prisma';

jest.mock('../../src/lib/prisma', () => ({
  hacker: {
    findUnique: jest.fn(),
  },
  project: {
    findUnique: jest.fn(),
  },
  projectToParticipant: {
    delete: jest.fn(),
  },
}));

jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn(),
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockAuth = require('@clerk/nextjs/server').auth as jest.Mock;

describe('/api/projects/[projectId]/participants/[hackerId]', () => {
  const projectId = 'test-project-id';
  const participantId = 'test-participant-id';

  function request() {
    return new NextRequest(
      `http://localhost:3000/api/projects/${projectId}/participants/${participantId}`,
      { method: 'DELETE' }
    );
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuth.mockReturnValue({ userId: 'clerk-launch-lead' });
    mockPrisma.hacker.findUnique.mockResolvedValue({
      id: 'launch-lead-id',
      role: 'HACKER',
    } as any);
    mockPrisma.project.findUnique.mockResolvedValue({
      launchLeadId: 'launch-lead-id',
    } as any);
  });

  it('allows the launch lead to remove a participant with an empty DELETE body', async () => {
    mockPrisma.projectToParticipant.delete.mockResolvedValue({
      hackerId: participantId,
      projectId,
    } as any);

    const response = await DELETE(request(), {
      params: { projectId, hackerId: participantId },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      message: 'Participant removed successfully',
    });
    expect(mockPrisma.projectToParticipant.delete).toHaveBeenCalledWith({
      where: {
        hackerId_projectId: {
          hackerId: participantId,
          projectId,
        },
      },
    });
  });

  it('allows a site admin to remove a participant', async () => {
    mockPrisma.hacker.findUnique.mockResolvedValue({
      id: 'admin-id',
      role: 'SITE_ADMIN',
    } as any);
    mockPrisma.projectToParticipant.delete.mockResolvedValue({} as any);

    const response = await DELETE(request(), {
      params: { projectId, hackerId: participantId },
    });

    expect(response.status).toBe(200);
  });

  it('rejects signed-out users', async () => {
    mockAuth.mockReturnValue({ userId: null });

    const response = await DELETE(request(), {
      params: { projectId, hackerId: participantId },
    });

    expect(response.status).toBe(401);
    expect(mockPrisma.projectToParticipant.delete).not.toHaveBeenCalled();
  });

  it('rejects team members who do not manage the team', async () => {
    mockPrisma.hacker.findUnique.mockResolvedValue({
      id: 'team-member-id',
      role: 'HACKER',
    } as any);

    const response = await DELETE(request(), {
      params: { projectId, hackerId: participantId },
    });

    expect(response.status).toBe(403);
    expect(mockPrisma.projectToParticipant.delete).not.toHaveBeenCalled();
  });

  it('returns 404 when the project does not exist', async () => {
    mockPrisma.project.findUnique.mockResolvedValue(null);

    const response = await DELETE(request(), {
      params: { projectId, hackerId: participantId },
    });

    expect(response.status).toBe(404);
    expect(mockPrisma.projectToParticipant.delete).not.toHaveBeenCalled();
  });

  it('returns 500 when participant removal fails', async () => {
    mockPrisma.projectToParticipant.delete.mockRejectedValue(
      new Error('Database error')
    );

    const response = await DELETE(request(), {
      params: { projectId, hackerId: participantId },
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'Error removing participant',
    });
  });
});
