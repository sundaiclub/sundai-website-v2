jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {},
}))

import {
  getCurrentOrganizerNoteForActor,
  getOrganizerNoteAccess,
  listOrganizerNoteRevisionsForActor,
  type OrganizerNoteRelevance,
} from '../../src/lib/organizerNotes'
import {
  buildHacker,
  buildOrganizerNote,
  buildOrganizerNoteRevision,
  buildSiteAdmin,
} from '../utils/event-management-fixtures'

type OrganizerNoteDb = NonNullable<
  Parameters<typeof getCurrentOrganizerNoteForActor>[2]
>

type ScenarioDbOptions = {
  actorId?: string | null
  actorRole?: string | null
  chapterAdminChapterIds?: string[]
  assignedStaff?: Array<{
    eventId: string
    role: 'MC' | 'CO_MC'
    event?: { chapterId?: string | null } | null
  }>
  targetChapterIds?: string[]
  targetRegistrations?: Array<{
    eventId: string
    event?: { chapterId?: string | null } | null
  }>
}

const targetHacker = buildHacker({
  id: 'hacker-target',
  clerkId: 'clerk-target',
  name: 'Target Hacker',
  username: 'targethacker',
})
const currentNote = buildOrganizerNote({ hackerId: targetHacker.id })
const revisions = [
  buildOrganizerNoteRevision({
    id: 'organizer-note-revision-newest',
    hackerId: targetHacker.id,
    noteId: currentNote.id,
  }),
]

describe('organizer note revision visibility', () => {
  it.each([
    {
      label: 'site admin',
      relevance: relevance({ isSiteAdmin: true }),
      expected: {
        canViewCurrentNote: true,
        canEditCurrentNote: true,
        canViewRevisions: true,
      },
    },
    {
      label: 'relevant chapter admin',
      relevance: relevance({
        chapterAdminChapterIds: ['chapter-boston'],
        targetChapterIds: ['chapter-boston'],
      }),
      expected: {
        canViewCurrentNote: true,
        canEditCurrentNote: true,
        canViewRevisions: true,
      },
    },
    {
      label: 'assigned MC',
      relevance: relevance({
        assignedEventStaff: [
          {
            eventId: 'event-boston-demo-night',
            chapterId: 'chapter-boston',
            role: 'MC',
          },
        ],
        targetEventIds: ['event-boston-demo-night'],
      }),
      expected: {
        canViewCurrentNote: true,
        canEditCurrentNote: true,
        canViewRevisions: false,
      },
    },
    {
      label: 'assigned co-MC',
      relevance: relevance({
        assignedEventStaff: [
          {
            eventId: 'event-boston-demo-night',
            chapterId: 'chapter-boston',
            role: 'CO_MC',
          },
        ],
        targetEventIds: ['event-boston-demo-night'],
      }),
      expected: {
        canViewCurrentNote: true,
        canEditCurrentNote: true,
        canViewRevisions: false,
      },
    },
    {
      label: 'regular user',
      relevance: relevance({
        targetChapterIds: ['chapter-boston'],
        targetEventIds: ['event-boston-demo-night'],
      }),
      expected: {
        canViewCurrentNote: false,
        canEditCurrentNote: false,
        canViewRevisions: false,
      },
    },
    {
      label: 'signed-out user',
      relevance: relevance({
        actorId: null,
        targetChapterIds: ['chapter-boston'],
        targetEventIds: ['event-boston-demo-night'],
      }),
      expected: {
        canViewCurrentNote: false,
        canEditCurrentNote: false,
        canViewRevisions: false,
      },
    },
  ])('evaluates access flags for $label', ({ relevance, expected }) => {
    expect(getOrganizerNoteAccess(relevance)).toEqual(expected)
  })

  it.each([
    {
      label: 'site admin',
      actor: buildSiteAdmin(),
      db: createScenarioDb({
        actorId: 'hacker-site-admin',
        actorRole: 'SITE_ADMIN',
      }),
      canViewCurrentNote: true,
      canViewRevisions: true,
    },
    {
      label: 'relevant chapter admin',
      actor: buildHacker({ id: 'hacker-chapter-admin' }),
      db: createScenarioDb({
        actorId: 'hacker-chapter-admin',
        chapterAdminChapterIds: ['chapter-boston'],
        targetChapterIds: ['chapter-boston'],
      }),
      canViewCurrentNote: true,
      canViewRevisions: true,
    },
    {
      label: 'chapter admin for target event chapter',
      actor: buildHacker({ id: 'hacker-chapter-admin' }),
      db: createScenarioDb({
        actorId: 'hacker-chapter-admin',
        chapterAdminChapterIds: ['chapter-boston'],
        targetRegistrations: [
          {
            eventId: 'event-boston-demo-night',
            event: { chapterId: 'chapter-boston' },
          },
        ],
      }),
      canViewCurrentNote: true,
      canViewRevisions: true,
    },
    {
      label: 'assigned MC',
      actor: buildHacker({ id: 'hacker-event-mc' }),
      db: createScenarioDb({
        actorId: 'hacker-event-mc',
        assignedStaff: [
          {
            eventId: 'event-boston-demo-night',
            role: 'MC',
            event: { chapterId: 'chapter-boston' },
          },
        ],
        targetRegistrations: [
          {
            eventId: 'event-boston-demo-night',
            event: { chapterId: 'chapter-boston' },
          },
        ],
      }),
      canViewCurrentNote: true,
      canViewRevisions: false,
    },
    {
      label: 'assigned co-MC',
      actor: buildHacker({ id: 'hacker-event-co-mc' }),
      db: createScenarioDb({
        actorId: 'hacker-event-co-mc',
        assignedStaff: [
          {
            eventId: 'event-boston-demo-night',
            role: 'CO_MC',
            event: { chapterId: 'chapter-boston' },
          },
        ],
        targetRegistrations: [
          {
            eventId: 'event-boston-demo-night',
            event: { chapterId: 'chapter-boston' },
          },
        ],
      }),
      canViewCurrentNote: true,
      canViewRevisions: false,
    },
    {
      label: 'regular user',
      actor: buildHacker({ id: 'hacker-regular' }),
      db: createScenarioDb({
        actorId: 'hacker-regular',
        targetChapterIds: ['chapter-boston'],
        targetRegistrations: [
          {
            eventId: 'event-boston-demo-night',
            event: { chapterId: 'chapter-boston' },
          },
        ],
      }),
      canViewCurrentNote: false,
      canViewRevisions: false,
    },
    {
      label: 'signed-out user',
      actor: null,
      db: createScenarioDb({ actorId: null }),
      canViewCurrentNote: false,
      canViewRevisions: false,
    },
  ])(
    'applies actor-scoped current note and revision access for $label',
    async ({ actor, db, canViewCurrentNote, canViewRevisions }) => {
      const note = await getCurrentOrganizerNoteForActor(
        actor?.id,
        targetHacker.id,
        db
      )
      const actorRevisions = await listOrganizerNoteRevisionsForActor(
        actor?.id,
        targetHacker.id,
        { take: 10, skip: 0 },
        db
      )

      expect(note).toBe(canViewCurrentNote ? currentNote : null)
      expect(actorRevisions).toBe(canViewRevisions ? revisions : null)

      const mockDb = db as unknown as MockOrganizerNoteDb
      if (canViewCurrentNote) {
        expect(mockDb.hackerOrganizerNote.findUnique).toHaveBeenCalledWith({
          where: { hackerId: targetHacker.id },
        })
      } else {
        expect(mockDb.hackerOrganizerNote.findUnique).not.toHaveBeenCalled()
      }

      if (canViewRevisions) {
        expect(mockDb.hackerOrganizerNoteRevision.findMany).toHaveBeenCalledWith({
          where: { hackerId: targetHacker.id },
          orderBy: { createdAt: 'desc' },
          take: 10,
          skip: 0,
        })
      } else {
        expect(mockDb.hackerOrganizerNoteRevision.findMany).not.toHaveBeenCalled()
      }
    }
  )
})

function relevance(
  overrides: Partial<OrganizerNoteRelevance> = {}
): OrganizerNoteRelevance {
  return {
    actorId: 'hacker-actor',
    targetHackerId: targetHacker.id,
    isSiteAdmin: false,
    chapterAdminChapterIds: [],
    assignedEventStaff: [],
    targetChapterIds: [],
    targetEventIds: [],
    ...overrides,
  }
}

type MockOrganizerNoteDb = {
  hacker: { findUnique: jest.Mock }
  chapterMembership: { findMany: jest.Mock }
  eventStaff: { findMany: jest.Mock }
  eventRegistration: { findMany: jest.Mock }
  hackerOrganizerNote: { findUnique: jest.Mock }
  hackerOrganizerNoteRevision: { findMany: jest.Mock }
}

function createScenarioDb(options: ScenarioDbOptions): OrganizerNoteDb {
  const actorId = options.actorId ?? 'hacker-actor'
  const actorRole = options.actorRole ?? 'HACKER'
  const db = {
    hacker: {
      findUnique: jest.fn(async () =>
        actorId ? { id: actorId, role: actorRole } : null
      ),
    },
    chapterMembership: {
      findMany: jest.fn(async (args) => {
        if (args.where?.hackerId === actorId) {
          return (options.chapterAdminChapterIds ?? []).map((chapterId) => ({
            chapterId,
          }))
        }

        return (options.targetChapterIds ?? []).map((chapterId) => ({
          chapterId,
        }))
      }),
    },
    eventStaff: {
      findMany: jest.fn(async () => options.assignedStaff ?? []),
    },
    eventRegistration: {
      findMany: jest.fn(async () => options.targetRegistrations ?? []),
    },
    hackerOrganizerNote: {
      findUnique: jest.fn(async () => currentNote),
    },
    hackerOrganizerNoteRevision: {
      findMany: jest.fn(async () => revisions),
    },
    $transaction: jest.fn(),
  }

  return db as unknown as OrganizerNoteDb
}
