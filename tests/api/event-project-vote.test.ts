import { NextRequest } from 'next/server'
import { PUT, DELETE } from '../../src/app/api/events/[eventId]/pitch/queue/[pitchProjectId]/vote/route'

jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    hacker: {
      findUnique: jest.fn(),
    },
    pitchProject: {
      findUnique: jest.fn(),
    },
    projectLike: {
      upsert: jest.fn(),
    },
    pitchProjectVote: {
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

describe('/api/events/[eventId]/queue/[pitchProjectId]/vote', () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  it('creates a LIKE vote and upserts the global project like', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-1' })
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h1' })
    prisma.pitchProject.findUnique.mockResolvedValue({
      id: 'ep1',
      pitchSessionId: 'ps1',
      projectId: 'p1',
      pitchSession: { eventId: 'e1', phase: '' },
    })
    prisma.projectLike.upsert.mockResolvedValue({ id: 'pl1' })
    prisma.pitchProjectVote.upsert.mockResolvedValue({
      id: 'epv1',
      pitchProjectId: 'ep1',
      hackerId: 'h1',
      value: 'LIKE',
    })
    prisma.$transaction.mockResolvedValue([
      { id: 'pl1' },
      { id: 'epv1', pitchProjectId: 'ep1', hackerId: 'h1', value: 'LIKE' },
    ])

    const request = new NextRequest('http://localhost:3000/api/events/e1/pitch/queue/ep1/vote', {
      method: 'PUT',
    })
    request.json = jest.fn().mockResolvedValue({ value: 'LIKE' })

    const response = await PUT(request, {
      params: { eventId: 'e1', pitchProjectId: 'ep1' },
    } as any)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({ id: 'epv1', pitchProjectId: 'ep1', hackerId: 'h1', value: 'LIKE' })
    expect(prisma.projectLike.upsert).toHaveBeenCalledWith({
      where: { projectId_hackerId: { projectId: 'p1', hackerId: 'h1' } },
      create: { projectId: 'p1', hackerId: 'h1' },
      update: {},
    })
    expect(prisma.pitchProjectVote.upsert).toHaveBeenCalledWith({
      where: { pitchProjectId_hackerId: { pitchProjectId: 'ep1', hackerId: 'h1' } },
      create: { pitchProjectId: 'ep1', hackerId: 'h1', value: 'LIKE' },
      update: { value: 'LIKE' },
    })
  })

  it('creates a DISLIKE vote without creating a global project like', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-1' })
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h1' })
    prisma.pitchProject.findUnique.mockResolvedValue({
      id: 'ep1',
      pitchSessionId: 'ps1',
      projectId: 'p1',
      pitchSession: { eventId: 'e1', phase: '' },
    })
    prisma.pitchProjectVote.upsert.mockResolvedValue({
      id: 'epv1',
      pitchProjectId: 'ep1',
      hackerId: 'h1',
      value: 'DISLIKE',
    })
    prisma.$transaction.mockResolvedValue([
      { id: 'epv1', pitchProjectId: 'ep1', hackerId: 'h1', value: 'DISLIKE' },
    ])

    const request = new NextRequest('http://localhost:3000/api/events/e1/pitch/queue/ep1/vote', {
      method: 'PUT',
    })
    request.json = jest.fn().mockResolvedValue({ value: 'DISLIKE' })

    const response = await PUT(request, {
      params: { eventId: 'e1', pitchProjectId: 'ep1' },
    } as any)

    expect(response.status).toBe(200)
    expect(prisma.projectLike.upsert).not.toHaveBeenCalled()
    expect(prisma.pitchProjectVote.upsert).toHaveBeenCalledWith({
      where: { pitchProjectId_hackerId: { pitchProjectId: 'ep1', hackerId: 'h1' } },
      create: { pitchProjectId: 'ep1', hackerId: 'h1', value: 'DISLIKE' },
      update: { value: 'DISLIKE' },
    })
  })

  it('allows pitch-vote changes during pitching', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-1' })
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h1' })
    prisma.pitchProject.findUnique.mockResolvedValue({
      id: 'ep1',
      pitchSessionId: 'ps1',
      projectId: 'p1',
      pitchSession: { eventId: 'e1', phase: 'PITCHING' },
    })
    prisma.projectLike.upsert.mockResolvedValue({ id: 'pl1' })
    prisma.pitchProjectVote.upsert.mockResolvedValue({
      id: 'epv1',
      pitchProjectId: 'ep1',
      hackerId: 'h1',
      value: 'LIKE',
    })
    prisma.$transaction.mockResolvedValue([
      { id: 'pl1' },
      { id: 'epv1', pitchProjectId: 'ep1', hackerId: 'h1', value: 'LIKE' },
    ])

    const request = new NextRequest('http://localhost:3000/api/events/e1/pitch/queue/ep1/vote', {
      method: 'PUT',
    })
    request.json = jest.fn().mockResolvedValue({ value: 'LIKE' })

    const response = await PUT(request, {
      params: { eventId: 'e1', pitchProjectId: 'ep1' },
    } as any)

    expect(response.status).toBe(200)
    expect(prisma.projectLike.upsert).toHaveBeenCalled()
    expect(prisma.pitchProjectVote.upsert).toHaveBeenCalled()
  })

  it.each(['DRAFT', 'NEEDS_INFO', 'SUBMITTED', 'APPROVED'])(
    'preserves hacker voting when project card status is %s',
    async cardStatus => {
      mockAuth.mockReturnValue({ userId: 'clerk-voter' })
      prisma.hacker.findUnique.mockResolvedValue({ id: 'h-voter' })
      prisma.pitchProject.findUnique.mockResolvedValue({
        id: 'ep-card-status',
        pitchSessionId: 'ps1',
        projectId: 'p1',
        cardStatus,
        pitchSession: { eventId: 'e1', phase: 'VOTING' },
      })
      prisma.projectLike.upsert.mockResolvedValue({ id: 'like-card-status' })
      prisma.pitchProjectVote.upsert.mockResolvedValue({
        id: 'vote-card-status',
        pitchProjectId: 'ep-card-status',
        hackerId: 'h-voter',
        value: 'LIKE',
      })
      prisma.$transaction.mockResolvedValue([
        { id: 'like-card-status' },
        {
          id: 'vote-card-status',
          pitchProjectId: 'ep-card-status',
          hackerId: 'h-voter',
          value: 'LIKE',
        },
      ])

      const request = new NextRequest(
        'http://localhost:3000/api/events/e1/pitch/queue/ep-card-status/vote',
        { method: 'PUT' }
      )
      request.json = jest.fn().mockResolvedValue({ value: 'LIKE' })

      const response = await PUT(request, {
        params: { eventId: 'e1', pitchProjectId: 'ep-card-status' },
      } as any)

      expect(response.status).toBe(200)
      expect(prisma.pitchProjectVote.upsert).toHaveBeenCalled()
    }
  )

  it('rejects pitch-vote changes after the event is finished', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-1' })
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h1' })
    prisma.pitchProject.findUnique.mockResolvedValue({
      id: 'ep1',
      pitchSessionId: 'ps1',
      projectId: 'p1',
      pitchSession: { eventId: 'e1', phase: 'FINISHED' },
    })

    const request = new NextRequest('http://localhost:3000/api/events/e1/pitch/queue/ep1/vote', {
      method: 'PUT',
    })
    request.json = jest.fn().mockResolvedValue({ value: 'LIKE' })

    const response = await PUT(request, {
      params: { eventId: 'e1', pitchProjectId: 'ep1' },
    } as any)

    expect(response.status).toBe(400)
    expect(prisma.projectLike.upsert).not.toHaveBeenCalled()
    expect(prisma.pitchProjectVote.upsert).not.toHaveBeenCalled()
  })

  it('deletes only the pitch vote', async () => {
    mockAuth.mockReturnValue({ userId: 'clerk-1' })
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h1' })
    prisma.pitchProject.findUnique.mockResolvedValue({
      id: 'ep1',
      pitchSessionId: 'ps1',
      projectId: 'p1',
      pitchSession: { eventId: 'e1', phase: '' },
    })
    prisma.pitchProjectVote.deleteMany.mockResolvedValue({ count: 1 })

    const request = new NextRequest('http://localhost:3000/api/events/e1/pitch/queue/ep1/vote', {
      method: 'DELETE',
    })

    const response = await DELETE(request, {
      params: { eventId: 'e1', pitchProjectId: 'ep1' },
    } as any)

    expect(response.status).toBe(204)
    expect(prisma.pitchProjectVote.deleteMany).toHaveBeenCalledWith({
      where: { pitchProjectId: 'ep1', hackerId: 'h1' },
    })
    expect(prisma.projectLike.upsert).not.toHaveBeenCalled()
  })
})
