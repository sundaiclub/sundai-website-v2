import { NextRequest } from 'next/server'
import { POST, DELETE } from '../../src/app/api/events/[eventId]/queue/[eventProjectId]/like/route'

jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    hacker: {
      findUnique: jest.fn(),
    },
    eventProject: {
      findUnique: jest.fn(),
    },
    projectLike: {
      upsert: jest.fn(),
    },
    eventProjectLike: {
      upsert: jest.fn(),
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}))

jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn(),
}))

const prisma = require('../../src/lib/prisma').default
const mockAuth = require('@clerk/nextjs/server').auth as jest.Mock

describe('/api/events/[eventId]/queue/[eventProjectId]/like', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('creates a pitch like and upserts the global project like', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-1' })
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h1' })
    prisma.eventProject.findUnique.mockResolvedValue({
      id: 'ep1',
      eventId: 'e1',
      projectId: 'p1',
      event: { phase: 'VOTING' },
    })
    prisma.projectLike.upsert.mockResolvedValue({ id: 'pl1' })
    prisma.eventProjectLike.upsert.mockResolvedValue({
      id: 'epl1',
      eventProjectId: 'ep1',
      hackerId: 'h1',
    })
    prisma.$transaction.mockResolvedValue([
      { id: 'pl1' },
      { id: 'epl1', eventProjectId: 'ep1', hackerId: 'h1' },
    ])

    const request = new NextRequest('http://localhost:3000/api/events/e1/queue/ep1/like', {
      method: 'POST',
    })

    const response = await POST(request, {
      params: { eventId: 'e1', eventProjectId: 'ep1' },
    } as any)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({ id: 'epl1', eventProjectId: 'ep1', hackerId: 'h1' })
    expect(prisma.projectLike.upsert).toHaveBeenCalledWith({
      where: { projectId_hackerId: { projectId: 'p1', hackerId: 'h1' } },
      create: { projectId: 'p1', hackerId: 'h1' },
      update: {},
    })
    expect(prisma.eventProjectLike.upsert).toHaveBeenCalledWith({
      where: { eventProjectId_hackerId: { eventProjectId: 'ep1', hackerId: 'h1' } },
      create: { eventProjectId: 'ep1', hackerId: 'h1' },
      update: {},
    })
  })

  it('rejects pitch-like changes after voting', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-1' })
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h1' })
    prisma.eventProject.findUnique.mockResolvedValue({
      id: 'ep1',
      eventId: 'e1',
      projectId: 'p1',
      event: { phase: 'PITCHING' },
    })

    const request = new NextRequest('http://localhost:3000/api/events/e1/queue/ep1/like', {
      method: 'POST',
    })

    const response = await POST(request, {
      params: { eventId: 'e1', eventProjectId: 'ep1' },
    } as any)

    expect(response.status).toBe(400)
    expect(prisma.projectLike.upsert).not.toHaveBeenCalled()
    expect(prisma.eventProjectLike.upsert).not.toHaveBeenCalled()
  })

  it('deletes only the pitch like', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-1' })
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h1' })
    prisma.eventProject.findUnique.mockResolvedValue({
      id: 'ep1',
      eventId: 'e1',
      projectId: 'p1',
      event: { phase: 'VOTING' },
    })
    prisma.eventProjectLike.deleteMany.mockResolvedValue({ count: 1 })

    const request = new NextRequest('http://localhost:3000/api/events/e1/queue/ep1/like', {
      method: 'DELETE',
    })

    const response = await DELETE(request, {
      params: { eventId: 'e1', eventProjectId: 'ep1' },
    } as any)

    expect(response.status).toBe(204)
    expect(prisma.eventProjectLike.deleteMany).toHaveBeenCalledWith({
      where: { eventProjectId: 'ep1', hackerId: 'h1' },
    })
    expect(prisma.projectLike.upsert).not.toHaveBeenCalled()
  })
})
