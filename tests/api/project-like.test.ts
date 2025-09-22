import { NextRequest } from 'next/server'
import { POST, DELETE } from '../../src/app/api/projects/[projectId]/like/route'
import { mockHacker } from '../utils/test-utils'

// Mock Prisma
jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    hacker: {
      findUnique: jest.fn(),
    },
    projectLike: {
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
  },
}))

// Get the mocked Prisma
const mockPrisma = require('../../src/lib/prisma').default

// Mock Clerk auth
jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn(),
}))

describe('/api/projects/[projectId]/like', () => {
  const mockAuth = require('@clerk/nextjs/server').auth
  const projectId = 'test-project-id'

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('POST', () => {
    it('creates a new like successfully', async () => {
      mockAuth.mockReturnValue({ userId: 'test-clerk-id' })
      mockPrisma.hacker.findUnique.mockResolvedValue(mockHacker)
      mockPrisma.projectLike.findUnique.mockResolvedValue(null)
      mockPrisma.projectLike.create.mockResolvedValue({
        id: 'like-id',
        projectId,
        hackerId: mockHacker.id,
        createdAt: new Date(),
      })

      const request = new NextRequest(`http://localhost:3000/api/projects/${projectId}/like`, {
        method: 'POST',
      })

      const response = await POST(request, { params: { projectId } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toMatchObject({
        id: 'like-id',
        projectId,
        hackerId: mockHacker.id,
      })
    })

    it('returns existing like if already exists', async () => {
      const existingLike = {
        id: 'existing-like-id',
        projectId,
        hackerId: mockHacker.id,
        createdAt: new Date(),
      }

      mockAuth.mockReturnValue({ userId: 'test-clerk-id' })
      mockPrisma.hacker.findUnique.mockResolvedValue(mockHacker)
      mockPrisma.projectLike.findUnique.mockResolvedValue(existingLike)

      const request = new NextRequest(`http://localhost:3000/api/projects/${projectId}/like`, {
        method: 'POST',
      })

      const response = await POST(request, { params: { projectId } })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toMatchObject({
        id: existingLike.id,
        projectId: existingLike.projectId,
        hackerId: existingLike.hackerId,
      })
      expect(mockPrisma.projectLike.create).not.toHaveBeenCalled()
    })

    it('returns 401 when user is not authenticated', async () => {
      mockAuth.mockReturnValue({ userId: null })

      const request = new NextRequest(`http://localhost:3000/api/projects/${projectId}/like`, {
        method: 'POST',
      })

      const response = await POST(request, { params: { projectId } })

      expect(response.status).toBe(401)
    })

    it('returns 404 when hacker is not found', async () => {
      mockAuth.mockReturnValue({ userId: 'test-clerk-id' })
      mockPrisma.hacker.findUnique.mockResolvedValue(null)

      const request = new NextRequest(`http://localhost:3000/api/projects/${projectId}/like`, {
        method: 'POST',
      })

      const response = await POST(request, { params: { projectId } })

      expect(response.status).toBe(404)
    })

    it('handles database errors', async () => {
      mockAuth.mockReturnValue({ userId: 'test-clerk-id' })
      mockPrisma.hacker.findUnique.mockRejectedValue(new Error('Database error'))

      const request = new NextRequest(`http://localhost:3000/api/projects/${projectId}/like`, {
        method: 'POST',
      })

      const response = await POST(request, { params: { projectId } })

      expect(response.status).toBe(500)
    })
  })

  describe('DELETE', () => {
    it('deletes a like successfully', async () => {
      mockAuth.mockReturnValue({ userId: 'test-clerk-id' })
      mockPrisma.hacker.findUnique.mockResolvedValue(mockHacker)
      mockPrisma.projectLike.delete.mockResolvedValue({})

      const request = new NextRequest(`http://localhost:3000/api/projects/${projectId}/like`, {
        method: 'DELETE',
      })

      const response = await DELETE(request, { params: { projectId } })

      expect(response.status).toBe(204)
      expect(mockPrisma.projectLike.delete).toHaveBeenCalledWith({
        where: {
          projectId_hackerId: {
            projectId,
            hackerId: mockHacker.id,
          },
        },
      })
    })

    it('returns 401 when user is not authenticated', async () => {
      mockAuth.mockReturnValue({ userId: null })

      const request = new NextRequest(`http://localhost:3000/api/projects/${projectId}/like`, {
        method: 'DELETE',
      })

      const response = await DELETE(request, { params: { projectId } })

      expect(response.status).toBe(401)
    })

    it('returns 404 when hacker is not found', async () => {
      mockAuth.mockReturnValue({ userId: 'test-clerk-id' })
      mockPrisma.hacker.findUnique.mockResolvedValue(null)

      const request = new NextRequest(`http://localhost:3000/api/projects/${projectId}/like`, {
        method: 'DELETE',
      })

      const response = await DELETE(request, { params: { projectId } })

      expect(response.status).toBe(404)
    })

    it('handles database errors', async () => {
      mockAuth.mockReturnValue({ userId: 'test-clerk-id' })
      mockPrisma.hacker.findUnique.mockResolvedValue(mockHacker)
      mockPrisma.projectLike.delete.mockRejectedValue(new Error('Database error'))

      const request = new NextRequest(`http://localhost:3000/api/projects/${projectId}/like`, {
        method: 'DELETE',
      })

      const response = await DELETE(request, { params: { projectId } })

      expect(response.status).toBe(500)
    })
  })
})
