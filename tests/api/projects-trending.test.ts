import { NextRequest } from 'next/server'
import { GET } from '../../src/app/api/projects/trending/route'

// Mock Prisma
jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    project: {
      findMany: jest.fn(),
    },
  },
}))

// Mock trending score util to be deterministic
jest.mock('../../src/lib/trending', () => ({
  calculateProjectScore: jest.fn(() => 1),
}))

const mockPrisma = require('../../src/lib/prisma').default

const baseProject = (overrides: Partial<any> = {}) => ({
  id: 'p1',
  title: 'Test Project',
  status: 'APPROVED',
  createdAt: new Date(),
  likes: [],
  techTags: [],
  domainTags: [],
  thumbnail: null,
  launchLead: { id: 'h1', name: 'Lead', avatar: null },
  participants: [],
  ...overrides,
})

describe('/api/projects/trending', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns week trending projects limited to 5', async () => {
    const projects = Array.from({ length: 8 }).map((_, i) =>
      baseProject({ id: `p${i}`, createdAt: new Date() })
    )
    mockPrisma.project.findMany.mockResolvedValue(projects)

    const req = new NextRequest('http://localhost:3000/api/projects/trending?range=week&limit=5')
    const res = await GET(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(Array.isArray(data)).toBe(true)
    expect(data).toHaveLength(5)
    expect(mockPrisma.project.findMany).toHaveBeenCalledWith({
      where: { status: "APPROVED" },
      include: {
        likes: true,
        techTags: true,
        domainTags: true,
        thumbnail: true,
        launchLead: { include: { avatar: true } },
        participants: { include: { hacker: { include: { avatar: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 250,
    })
  })

  it('returns month trending projects limited to 5', async () => {
    const projects = Array.from({ length: 6 }).map((_, i) =>
      baseProject({ id: `m${i}`, createdAt: new Date() })
    )
    mockPrisma.project.findMany.mockResolvedValue(projects)

    const req = new NextRequest('http://localhost:3000/api/projects/trending?range=month&limit=5')
    const res = await GET(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toHaveLength(5)
  })

  it('returns all time trending projects limited to 5', async () => {
    const projects = Array.from({ length: 4 }).map((_, i) =>
      baseProject({ id: `a${i}`, createdAt: new Date('2022-01-01') })
    )
    mockPrisma.project.findMany.mockResolvedValue(projects)

    const req = new NextRequest('http://localhost:3000/api/projects/trending?range=all&limit=5')
    const res = await GET(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data).toHaveLength(4)
  })

  it('handles database errors', async () => {
    mockPrisma.project.findMany.mockRejectedValue(new Error('db'))
    const req = new NextRequest('http://localhost:3000/api/projects/trending')
    const res = await GET(req)
    const data = await res.json()
    expect(res.status).toBe(500)
    expect(data).toEqual({ error: 'Failed to fetch trending projects' })
  })
})


