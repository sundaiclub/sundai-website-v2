import { NextRequest } from 'next/server'
import { GET } from '../../src/app/api/projects/route'

// Mock Prisma
jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    project: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    hacker: {
      findUnique: jest.fn(),
    },
  },
}))

// Mock Clerk server import to avoid ESM issues from route file
jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn(() => ({ userId: null })),
}))

const mockPrisma = require('../../src/lib/prisma').default

describe('/api/projects hacker filter', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('filters by hacker_id (launchLead or participant)', async () => {
    mockPrisma.project.count.mockResolvedValue(0)
    mockPrisma.project.findMany.mockResolvedValue([])

    const req = new NextRequest('http://localhost:3000/api/projects?hacker_id=h123&status=APPROVED')
    await GET(req)

    expect(mockPrisma.project.findMany).toHaveBeenCalled()
    const args = mockPrisma.project.findMany.mock.calls[0][0]
    expect(args.where).toBeDefined()
    // where should contain AND with status and OR ownership
    expect(args.where.AND).toEqual(
      expect.arrayContaining([
        { status: { in: ['APPROVED'] } },
        { OR: [
          { launchLeadId: 'h123' },
          { participants: { some: { hackerId: 'h123' } } },
        ]},
      ])
    )
  })

  it('resolves clerk_id to hacker and filters', async () => {
    mockPrisma.hacker.findUnique.mockResolvedValue({ id: 'resolved-h' })
    mockPrisma.project.count.mockResolvedValue(0)
    mockPrisma.project.findMany.mockResolvedValue([])

    const req = new NextRequest('http://localhost:3000/api/projects?clerk_id=c789')
    await GET(req)
    const args = mockPrisma.project.findMany.mock.calls[0][0]
    expect(args.where.AND).toEqual(
      expect.arrayContaining([
        { OR: [
          { launchLeadId: 'resolved-h' },
          { participants: { some: { hackerId: 'resolved-h' } } },
        ]},
      ])
    )
  })
})


