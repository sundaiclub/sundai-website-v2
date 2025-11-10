import { NextRequest } from 'next/server'
import { GET, POST } from '../../src/app/api/projects/route'
import { mockProject, mockHacker } from '../utils/test-utils'

// Mock Prisma
jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    project: {
      count: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    hacker: {
      findUnique: jest.fn(),
    },
    week: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  },
}))

// Mock Clerk auth
jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn(),
}))

// Mock GCP storage (kept for compatibility with imports in tests)
jest.mock('../../src/lib/gcp-storage', () => ({
  uploadToGCS: jest.fn(),
}))

// Get the mocked Prisma
const mockPrisma = require('../../src/lib/prisma').default

describe('/api/projects', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.IS_RESEARCH_SITE = 'false'
  })

  describe('GET (paginated)', () => {
    it('returns paginated projects successfully', async () => {
      mockPrisma.project.count.mockResolvedValue(1)
      mockPrisma.project.findMany.mockResolvedValue([mockProject])

      const request = new NextRequest('http://localhost:3000/api/projects?page=1&limit=10')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(Array.isArray(data.items)).toBe(true)
      expect(data.items).toHaveLength(1)
      expect(data.page).toBe(1)
      expect(data.pageCount).toBe(1)
      expect(data.total).toBe(1)
      expect(data.items[0]).toMatchObject({
        id: 'test-project-id',
        title: 'Test Project',
        status: 'APPROVED',
      })
    })

    it('returns items with thumbnail and avatars included', async () => {
      const projectWithMedia = {
        ...mockProject,
        thumbnail: { url: 'https://example.com/thumbnail.jpg' },
        launchLead: {
          ...mockProject.launchLead,
          avatar: { url: 'https://example.com/avatar-lead.jpg' },
        },
        participants: [
          {
            role: 'Dev',
            hacker: {
              id: 'h1',
              name: 'Hacker One',
              avatar: { url: 'https://example.com/avatar-h1.jpg' },
            },
          },
        ],
      }
      mockPrisma.project.count.mockResolvedValue(1)
      mockPrisma.project.findMany.mockResolvedValue([projectWithMedia])

      const request = new NextRequest('http://localhost:3000/api/projects?page=1&limit=10')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.items[0].thumbnail?.url).toBe('https://example.com/thumbnail.jpg')
      expect(data.items[0].launchLead?.avatar?.url).toBe('https://example.com/avatar-lead.jpg')
      expect(data.items[0].participants?.[0]?.hacker?.avatar?.url).toBe('https://example.com/avatar-h1.jpg')
    })

    it('applies status filter and sorting', async () => {
      mockPrisma.project.count.mockResolvedValue(1)
      mockPrisma.project.findMany.mockResolvedValue([mockProject])

      const request = new NextRequest('http://localhost:3000/api/projects?status=APPROVED&sort=newest')
      await GET(request)

      expect(mockPrisma.project.findMany).toHaveBeenCalled()
      const args = mockPrisma.project.findMany.mock.calls[0][0]
      expect(args).toMatchObject({
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' },
      })
      // where should contain status filter within AND
      expect(args.where.AND).toEqual(
        expect.arrayContaining([
          { status: { in: ['APPROVED'] } }
        ])
      )
    })
  })

  describe('POST', () => {
    const mockAuth = require('@clerk/nextjs/server').auth

    it('creates a new project successfully', async () => {
      mockAuth.mockReturnValue({ userId: 'test-clerk-id' })
      mockPrisma.hacker.findUnique.mockResolvedValue(mockHacker)
      mockPrisma.week.findFirst.mockResolvedValue({
        id: 'test-week-id',
        number: 1,
      })
      mockPrisma.project.create.mockResolvedValue(mockProject)

      const formData = new FormData()
      formData.append('title', 'New Project')
      formData.append('preview', 'A new project preview')
      formData.append('members', JSON.stringify([{ id: 'test-hacker-id', role: 'Developer' }]))

      const request = new NextRequest('http://localhost:3000/api/projects', {
        method: 'POST',
        body: formData,
      })

      // Mock the formData method to return our test data
      request.formData = jest.fn().mockResolvedValue(formData)

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toMatchObject({
        id: mockProject.id,
        title: mockProject.title,
        preview: mockProject.preview,
        description: mockProject.description,
        githubUrl: mockProject.githubUrl,
        demoUrl: mockProject.demoUrl,
        blogUrl: mockProject.blogUrl,
        status: mockProject.status,
        is_starred: mockProject.is_starred,
        is_broken: mockProject.is_broken,
      })
    })

    it('returns 401 when user is not authenticated', async () => {
      mockAuth.mockReturnValue({ userId: null })

      const formData = new FormData()
      formData.append('title', 'New Project')
      formData.append('preview', 'A new project preview')
      formData.append('members', JSON.stringify([]))

      const request = new NextRequest('http://localhost:3000/api/projects', {
        method: 'POST',
        body: formData,
      })

      request.formData = jest.fn().mockResolvedValue(formData)

      const response = await POST(request)

      expect(response.status).toBe(401)
    })

    it('returns 400 when title is missing', async () => {
      mockAuth.mockReturnValue({ userId: 'test-clerk-id' })

      const formData = new FormData()
      formData.append('preview', 'A new project preview')
      formData.append('members', JSON.stringify([]))

      const request = new NextRequest('http://localhost:3000/api/projects', {
        method: 'POST',
        body: formData,
      })

      request.formData = jest.fn().mockResolvedValue(formData)

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data).toEqual({ message: 'Title is required' })
    })

    it('returns 400 when preview is missing', async () => {
      mockAuth.mockReturnValue({ userId: 'test-clerk-id' })

      const formData = new FormData()
      formData.append('title', 'New Project')
      formData.append('members', JSON.stringify([]))

      const request = new NextRequest('http://localhost:3000/api/projects', {
        method: 'POST',
        body: formData,
      })

      request.formData = jest.fn().mockResolvedValue(formData)

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data).toEqual({ message: 'Preview is required' })
    })

    it('returns 400 when preview is too long', async () => {
      mockAuth.mockReturnValue({ userId: 'test-clerk-id' })

      const formData = new FormData()
      formData.append('title', 'New Project')
      formData.append('preview', 'A'.repeat(101)) // 101 characters
      formData.append('members', JSON.stringify([]))

      const request = new NextRequest('http://localhost:3000/api/projects', {
        method: 'POST',
        body: formData,
      })

      request.formData = jest.fn().mockResolvedValue(formData)

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data).toEqual({ message: 'Preview must be 100 characters or less' })
    })

    it('returns 404 when hacker is not found', async () => {
      mockAuth.mockReturnValue({ userId: 'test-clerk-id' })
      mockPrisma.hacker.findUnique.mockResolvedValue(null)

      const formData = new FormData()
      formData.append('title', 'New Project')
      formData.append('preview', 'A new project preview')
      formData.append('members', JSON.stringify([]))

      const request = new NextRequest('http://localhost:3000/api/projects', {
        method: 'POST',
        body: formData,
      })

      request.formData = jest.fn().mockResolvedValue(formData)

      const response = await POST(request)

      expect(response.status).toBe(404)
    })

    it('creates a new week when none exists', async () => {
      mockAuth.mockReturnValue({ userId: 'test-clerk-id' })
      mockPrisma.hacker.findUnique.mockResolvedValue(mockHacker)
      mockPrisma.week.findFirst.mockResolvedValue(null)
      mockPrisma.week.create.mockResolvedValue({
        id: 'new-week-id',
        number: 1,
      })
      mockPrisma.project.create.mockResolvedValue(mockProject)

      const formData = new FormData()
      formData.append('title', 'New Project')
      formData.append('preview', 'A new project preview')
      formData.append('members', JSON.stringify([]))

      const request = new NextRequest('http://localhost:3000/api/projects', {
        method: 'POST',
        body: formData,
      })

      request.formData = jest.fn().mockResolvedValue(formData)

      await POST(request)

      expect(mockPrisma.week.create).toHaveBeenCalled()
    })

    it('handles database errors during creation', async () => {
      mockAuth.mockReturnValue({ userId: 'test-clerk-id' })
      mockPrisma.hacker.findUnique.mockResolvedValue(mockHacker)
      mockPrisma.week.findFirst.mockResolvedValue({
        id: 'test-week-id',
        number: 1,
      })
      mockPrisma.project.create.mockRejectedValue(new Error('Database error'))

      const formData = new FormData()
      formData.append('title', 'New Project')
      formData.append('preview', 'A new project preview')
      formData.append('members', JSON.stringify([]))

      const request = new NextRequest('http://localhost:3000/api/projects', {
        method: 'POST',
        body: formData,
      })

      request.formData = jest.fn().mockResolvedValue(formData)

      const response = await POST(request)

      expect(response.status).toBe(500)
    })
  })
})
