import { render, screen } from '@testing-library/react';
import PitchLandingPage from '@/app/pitch/page';
import { ThemeProvider } from '@/app/contexts/ThemeContext';

jest.mock('@clerk/nextjs/server', () => ({ auth: jest.fn() }));
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    hacker: { findUnique: jest.fn() },
    event: { findMany: jest.fn() },
  },
}));

const prisma = require('@/lib/prisma').default;
const mockAuth = require('@clerk/nextjs/server').auth as jest.Mock;

describe('PitchLandingPage', () => {
  beforeEach(() => jest.clearAllMocks());

  it('asks signed-out visitors to sign in without querying events', async () => {
    mockAuth.mockReturnValue({ userId: null });

    render(<ThemeProvider>{await PitchLandingPage()}</ThemeProvider>);

    expect(
      screen.getByText('Sign in to view your active events.')
    ).toBeVisible();
    expect(prisma.event.findMany).not.toHaveBeenCalled();
  });

  it('loads eligible current events ending soonest first', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-1' });
    prisma.hacker.findUnique.mockResolvedValue({
      id: 'hacker-1',
      role: 'HACKER',
    });
    prisma.event.findMany.mockResolvedValue([
      {
        id: 'event-1',
        title: 'Boston Build Night',
        slug: 'build-night',
        chapter: { name: 'Sundai Boston', slug: 'boston' },
      },
    ]);

    render(<ThemeProvider>{await PitchLandingPage()}</ThemeProvider>);

    expect(
      screen.getByRole('button', { name: /boston build night/i })
    ).toBeVisible();
    expect(prisma.event.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'PUBLISHED',
          startTime: { lte: expect.any(Date) },
          endTime: { gte: expect.any(Date) },
          pitchSessions: { some: { phase: { not: 'FINISHED' } } },
          OR: expect.arrayContaining([
            { staff: { some: { hackerId: 'hacker-1' } } },
            {
              chapter: {
                memberships: {
                  some: {
                    hackerId: 'hacker-1',
                    role: 'ADMIN',
                    status: 'ACTIVE',
                  },
                },
              },
            },
          ]),
        }),
        orderBy: [{ endTime: 'asc' }, { title: 'asc' }],
      })
    );
  });
});
