import { NextRequest } from 'next/server'
import { GET, POST } from '../../src/app/api/events/[eventId]/ideas/route'
import {
  DELETE,
  PATCH,
} from '../../src/app/api/events/[eventId]/ideas/[ideaId]/route'
import { parseEventIdeaInput } from '../../src/lib/eventIdeas'

jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    event: { findFirst: jest.fn() },
    eventIdea: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
  },
}))

jest.mock('../../src/lib/eventManagementApi', () => ({
  getCurrentHacker: jest.fn(),
}))

jest.mock('../../src/lib/eventManagementAuth', () => ({
  ...jest.requireActual('../../src/lib/eventManagementAuth'),
  getEventPermissionContext: jest.fn(),
}))

const prisma = require('../../src/lib/prisma').default
const mockGetCurrentHacker = require('../../src/lib/eventManagementApi')
  .getCurrentHacker as jest.Mock
const mockGetEventPermissionContext = require('../../src/lib/eventManagementAuth')
  .getEventPermissionContext as jest.Mock

const createdAt = new Date('2026-11-10T15:30:00.000Z')
const ideaRecord = {
  id: 'idea-1',
  hackerId: 'h1',
  name: 'Ada',
  idea: 'A robot that waters plants',
  description: null,
  createdAt,
}
const anonymousRecord = { ...ideaRecord, id: 'idea-2', hackerId: null }

function jsonRequest(method: string, body: unknown) {
  const request = new NextRequest('http://localhost:3000/api/events/e1/ideas', {
    method,
  })
  request.json = jest.fn().mockResolvedValue(body)
  return request
}

const routeProps = { params: Promise.resolve({ eventId: 'e1' }) }
const ideaRouteProps = {
  params: Promise.resolve({ eventId: 'e1', ideaId: 'idea-1' }),
}

function signInAs(hackerId: string, permissions: Record<string, unknown> = {}) {
  mockGetCurrentHacker.mockResolvedValue({
    id: hackerId,
    role: null,
    name: 'Ada',
    email: null,
  })
  mockGetEventPermissionContext.mockResolvedValue({
    actor: { id: hackerId, role: null },
    chapterMembership: null,
    staff: null,
    ...permissions,
  })
}

function signInAsOrganizer(hackerId = 'mc1') {
  signInAs(hackerId, { staff: { hackerId, role: 'MC' } })
}

describe('/api/events/[eventId]/ideas', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    prisma.event.findFirst.mockResolvedValue({ id: 'e1' })
    mockGetCurrentHacker.mockResolvedValue(null)
  })

  it('lists ideas newest first without exposing author ids', async () => {
    prisma.eventIdea.findMany.mockResolvedValue([ideaRecord])

    const response = await GET(new Request('http://localhost'), routeProps)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.ideas).toEqual([
      {
        id: 'idea-1',
        name: 'Ada',
        idea: 'A robot that waters plants',
        description: null,
        createdAt: createdAt.toISOString(),
        canEdit: false,
        canDelete: false,
      },
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

  it('lets viewers edit and delete only their own ideas', async () => {
    signInAs('h1')
    prisma.eventIdea.findMany.mockResolvedValue([ideaRecord, anonymousRecord])

    const response = await GET(new Request('http://localhost'), routeProps)
    const body = await response.json()

    expect(
      body.ideas.map((idea: { canEdit: boolean; canDelete: boolean }) => [
        idea.canEdit,
        idea.canDelete,
      ])
    ).toEqual([
      [true, true],
      [false, false],
    ])
  })

  it('lets organizers delete every idea', async () => {
    signInAsOrganizer()
    prisma.eventIdea.findMany.mockResolvedValue([ideaRecord, anonymousRecord])

    const response = await GET(new Request('http://localhost'), routeProps)
    const body = await response.json()

    expect(
      body.ideas.map((idea: { canDelete: boolean }) => idea.canDelete)
    ).toEqual([true, true])
  })

  it('returns 404 for events that are not public', async () => {
    prisma.event.findFirst.mockResolvedValue(null)

    const getResponse = await GET(new Request('http://localhost'), routeProps)
    const postResponse = await POST(
      jsonRequest('POST', { name: 'Ada', idea: 'Idea' }),
      routeProps
    )

    expect(getResponse.status).toBe(404)
    expect(postResponse.status).toBe(404)
    expect(prisma.eventIdea.findMany).not.toHaveBeenCalled()
    expect(prisma.eventIdea.create).not.toHaveBeenCalled()
  })

  it('accepts ideas from signed-out visitors', async () => {
    prisma.eventIdea.create.mockResolvedValue(anonymousRecord)

    const response = await POST(
      jsonRequest('POST', { name: '  Ada ', idea: ' A robot that waters plants ' }),
      routeProps
    )

    expect(response.status).toBe(201)
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
    signInAs('h1')
    prisma.eventIdea.create.mockResolvedValue({
      ...ideaRecord,
      description: 'Uses soil sensors',
    })

    const response = await POST(
      jsonRequest('POST', {
        name: 'Ada',
        idea: 'A robot that waters plants',
        description: 'Uses soil sensors',
      }),
      routeProps
    )
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body).toMatchObject({
      id: 'idea-1',
      description: 'Uses soil sensors',
      canEdit: true,
    })
    expect(body).not.toHaveProperty('hackerId')
    expect(prisma.eventIdea.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ hackerId: 'h1' }),
      })
    )
  })

  it('rejects ideas without a name or idea', async () => {
    const response = await POST(
      jsonRequest('POST', { name: ' ', idea: 'x' }),
      routeProps
    )
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.message).toBe('Name is required')
    expect(prisma.eventIdea.create).not.toHaveBeenCalled()
  })
})

describe('/api/events/[eventId]/ideas/[ideaId]', () => {
  const edit = { name: 'Ada', idea: 'A drone that waters plants' }

  beforeEach(() => {
    jest.resetAllMocks()
    prisma.event.findFirst.mockResolvedValue({ id: 'e1' })
    mockGetCurrentHacker.mockResolvedValue(null)
  })

  it('lets authors edit their own ideas', async () => {
    signInAs('h1')
    prisma.eventIdea.findFirst.mockResolvedValue({ hackerId: 'h1' })
    prisma.eventIdea.update.mockResolvedValue({ ...ideaRecord, ...edit })

    const response = await PATCH(jsonRequest('PATCH', edit), ideaRouteProps)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toMatchObject({ idea: edit.idea, canEdit: true })
    expect(prisma.eventIdea.findFirst).toHaveBeenCalledWith({
      where: { id: 'idea-1', eventId: 'e1' },
      select: { hackerId: true },
    })
    expect(prisma.eventIdea.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'idea-1' },
        data: { ...edit, description: null },
      })
    )
  })

  it('requires sign-in to edit', async () => {
    const response = await PATCH(jsonRequest('PATCH', edit), ideaRouteProps)

    expect(response.status).toBe(401)
    expect(prisma.eventIdea.update).not.toHaveBeenCalled()
  })

  it('blocks edits to other people’s and anonymous ideas, even for organizers', async () => {
    signInAsOrganizer()
    for (const hackerId of ['h1', null]) {
      prisma.eventIdea.findFirst.mockResolvedValue({ hackerId })

      const response = await PATCH(jsonRequest('PATCH', edit), ideaRouteProps)

      expect(response.status).toBe(403)
    }
    expect(prisma.eventIdea.update).not.toHaveBeenCalled()
  })

  it('returns 404 when editing an idea from another event', async () => {
    signInAs('h1')
    prisma.eventIdea.findFirst.mockResolvedValue(null)

    const response = await PATCH(jsonRequest('PATCH', edit), ideaRouteProps)

    expect(response.status).toBe(404)
  })

  it('validates edited fields', async () => {
    signInAs('h1')
    prisma.eventIdea.findFirst.mockResolvedValue({ hackerId: 'h1' })

    const response = await PATCH(
      jsonRequest('PATCH', { name: 'Ada', idea: ' ' }),
      ideaRouteProps
    )

    expect(response.status).toBe(400)
    expect(prisma.eventIdea.update).not.toHaveBeenCalled()
  })

  it('lets organizers delete ideas from their event', async () => {
    signInAsOrganizer()
    prisma.eventIdea.deleteMany.mockResolvedValue({ count: 1 })

    const response = await DELETE(new Request('http://localhost'), ideaRouteProps)

    expect(response.status).toBe(204)
    expect(mockGetEventPermissionContext).toHaveBeenCalledWith(
      prisma,
      'mc1',
      'e1'
    )
    expect(prisma.eventIdea.deleteMany).toHaveBeenCalledWith({
      where: { id: 'idea-1', eventId: 'e1' },
    })
  })

  it('returns 404 when an organizer deletes a missing idea', async () => {
    signInAsOrganizer()
    prisma.eventIdea.deleteMany.mockResolvedValue({ count: 0 })

    const response = await DELETE(new Request('http://localhost'), ideaRouteProps)

    expect(response.status).toBe(404)
  })

  it('lets authors delete their own ideas', async () => {
    signInAs('h1')
    prisma.eventIdea.findFirst.mockResolvedValue({ hackerId: 'h1' })
    prisma.eventIdea.deleteMany.mockResolvedValue({ count: 1 })

    const response = await DELETE(new Request('http://localhost'), ideaRouteProps)

    expect(response.status).toBe(204)
    expect(prisma.eventIdea.findFirst).toHaveBeenCalledWith({
      where: { id: 'idea-1', eventId: 'e1' },
      select: { hackerId: true },
    })
    expect(prisma.eventIdea.deleteMany).toHaveBeenCalledWith({
      where: { id: 'idea-1', eventId: 'e1' },
    })
  })

  it('blocks signed-in non-organizers from deleting other people’s and anonymous ideas', async () => {
    signInAs('h2')
    for (const hackerId of ['h1', null]) {
      prisma.eventIdea.findFirst.mockResolvedValue({ hackerId })

      const response = await DELETE(
        new Request('http://localhost'),
        ideaRouteProps
      )
      const body = await response.json()

      expect(response.status).toBe(403)
      expect(body.message).toBe('You can only delete your own ideas')
    }
    expect(prisma.eventIdea.deleteMany).not.toHaveBeenCalled()
  })

  it('returns 404 when a non-organizer deletes a missing idea', async () => {
    signInAs('h1')
    prisma.eventIdea.findFirst.mockResolvedValue(null)

    const response = await DELETE(new Request('http://localhost'), ideaRouteProps)

    expect(response.status).toBe(404)
    expect(prisma.eventIdea.deleteMany).not.toHaveBeenCalled()
  })

  it('requires sign-in to delete', async () => {
    const response = await DELETE(new Request('http://localhost'), ideaRouteProps)

    expect(response.status).toBe(401)
    expect(prisma.eventIdea.findFirst).not.toHaveBeenCalled()
    expect(prisma.eventIdea.deleteMany).not.toHaveBeenCalled()
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
