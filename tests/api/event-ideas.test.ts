import { NextRequest } from 'next/server'
import { GET, POST } from '../../src/app/api/events/[eventId]/ideas/route'
import { parseEventIdeaInput } from '../../src/lib/eventIdeas'

jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    event: { findFirst: jest.fn() },
    hacker: { findUnique: jest.fn() },
    eventIdea: { findMany: jest.fn(), create: jest.fn() },
  },
}))

jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn(),
}))

const prisma = require('../../src/lib/prisma').default
const mockAuth = require('@clerk/nextjs/server').auth as jest.Mock

const createdAt = new Date('2026-11-10T15:30:00.000Z')
const ideaRecord = {
  id: 'idea-1',
  name: 'Ada',
  idea: 'A robot that waters plants',
  description: null,
  createdAt,
}

function postRequest(body: unknown) {
  const request = new NextRequest('http://localhost:3000/api/events/e1/ideas', {
    method: 'POST',
  })
  request.json = jest.fn().mockResolvedValue(body)
  return request
}

const routeProps = { params: Promise.resolve({ eventId: 'e1' }) }

describe('/api/events/[eventId]/ideas', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    prisma.event.findFirst.mockResolvedValue({ id: 'e1' })
  })

  it('lists ideas newest first for a public event', async () => {
    prisma.eventIdea.findMany.mockResolvedValue([ideaRecord])

    const response = await GET(new Request('http://localhost'), routeProps)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.ideas).toEqual([
      { ...ideaRecord, createdAt: createdAt.toISOString() },
    ])
    expect(prisma.event.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'e1',
          status: 'PUBLISHED',
          visibility: 'PUBLIC',
        }),
      })
    )
    expect(prisma.eventIdea.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { eventId: 'e1' },
        orderBy: { createdAt: 'desc' },
      })
    )
  })

  it('returns 404 for events that are not public', async () => {
    prisma.event.findFirst.mockResolvedValue(null)

    const getResponse = await GET(new Request('http://localhost'), routeProps)
    const postResponse = await POST(
      postRequest({ name: 'Ada', idea: 'Idea' }),
      routeProps
    )

    expect(getResponse.status).toBe(404)
    expect(postResponse.status).toBe(404)
    expect(prisma.eventIdea.findMany).not.toHaveBeenCalled()
    expect(prisma.eventIdea.create).not.toHaveBeenCalled()
  })

  it('accepts ideas from signed-out visitors', async () => {
    mockAuth.mockResolvedValue({ userId: null })
    prisma.eventIdea.create.mockResolvedValue(ideaRecord)

    const response = await POST(
      postRequest({ name: '  Ada ', idea: ' A robot that waters plants ' }),
      routeProps
    )

    expect(response.status).toBe(201)
    expect(prisma.hacker.findUnique).not.toHaveBeenCalled()
    expect(prisma.eventIdea.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          eventId: 'e1',
          hackerId: null,
          name: 'Ada',
          idea: 'A robot that waters plants',
          description: null,
        },
      })
    )
  })

  it('links ideas to the signed-in hacker', async () => {
    mockAuth.mockResolvedValue({ userId: 'clerk-1' })
    prisma.hacker.findUnique.mockResolvedValue({ id: 'h1' })
    prisma.eventIdea.create.mockResolvedValue({
      ...ideaRecord,
      description: 'Uses soil sensors',
    })

    const response = await POST(
      postRequest({
        name: 'Ada',
        idea: 'A robot that waters plants',
        description: 'Uses soil sensors',
      }),
      routeProps
    )
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body).toMatchObject({ id: 'idea-1', description: 'Uses soil sensors' })
    expect(prisma.eventIdea.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ hackerId: 'h1' }),
      })
    )
  })

  it('rejects ideas without a name or idea', async () => {
    const response = await POST(postRequest({ name: ' ', idea: 'x' }), routeProps)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.message).toBe('Name is required')
    expect(prisma.eventIdea.create).not.toHaveBeenCalled()
  })
})

describe('parseEventIdeaInput', () => {
  it('requires an idea', () => {
    expect(parseEventIdeaInput({ name: 'Ada' })).toEqual({
      error: 'Idea is required',
    })
  })

  it('rejects oversized fields', () => {
    expect(
      parseEventIdeaInput({ name: 'Ada', idea: 'x'.repeat(201) })
    ).toEqual({ error: 'Idea must be 200 characters or fewer' })
    expect(
      parseEventIdeaInput({
        name: 'Ada',
        idea: 'Idea',
        description: 'x'.repeat(2001),
      })
    ).toEqual({ error: 'Description must be 2000 characters or fewer' })
  })

  it('treats a blank description as missing', () => {
    expect(
      parseEventIdeaInput({ name: 'Ada', idea: 'Idea', description: '   ' })
    ).toEqual({ input: { name: 'Ada', idea: 'Idea', description: null } })
  })
})
