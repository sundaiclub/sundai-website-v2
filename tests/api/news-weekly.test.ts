import { NextRequest } from 'next/server'
import { GET } from '../../src/app/api/news/weekly/route'

jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    project: {
      findMany: jest.fn(),
    },
  },
}))

const mockPrisma = require('../../src/lib/prisma').default

describe('/api/news/weekly', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.IS_RESEARCH_SITE = 'false'
  })

  it('returns top projects trending in the last 14 days (time-decayed likes)', async () => {
    const now = new Date()
    const makeProject = (id: string, likes: number, createdAtOffsetDays: number) => ({
      id,
      title: `Project ${id}`,
      preview: 'Preview',
      createdAt: new Date(now.getTime() - createdAtOffsetDays * 86400000),
      thumbnail: { url: 'https://example.com/t.png', alt: 't' },
      launchLead: { id: `h-${id}`, name: `Lead ${id}` },
      participants: [],
      likes: Array.from({ length: likes }).map((_, i) => ({ hackerId: `u-${i}`, createdAt: now })),
      techTags: [],
      domainTags: [],
    })

    mockPrisma.project.findMany.mockResolvedValue([
      makeProject('a', 5, 1),
      makeProject('b', 10, 2),
      makeProject('c', 1, 3),
      makeProject('d', 7, 4),
    ])

    const req = new NextRequest('http://localhost:3000/api/news/weekly')
    const res = await GET(req as any)
    const data = await res.json()

    expect(res.status).toBe(200)
    // With 4 mocks available, should cap at available <= 5
    expect(data.topProjects).toHaveLength(4)
    // Time decay with 1-day half-life equivalent puts newer likes higher
    expect(data.topProjects.map((p: any) => p.id)).toEqual(['a', 'b', 'd', 'c'])
    expect(data.topProjects[0]).toMatchObject({ likeCount: 5 })
  })

  it('handles db errors', async () => {
    mockPrisma.project.findMany.mockRejectedValue(new Error('db'))
    const req = new NextRequest('http://localhost:3000/api/news/weekly')
    const res = await GET(req as any)

    expect(res.status).toBe(500)
  })
})


