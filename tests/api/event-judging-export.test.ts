/** @jest-environment-options {"customExportConditions": ["node", "node-addons"]} */
import ExcelJS from 'exceljs';
import { GET } from '../../src/app/api/events/[eventId]/judging/export/route';

const mockAuth = jest.fn();
jest.mock('@clerk/nextjs/server', () => ({ auth: () => mockAuth() }));
jest.mock('../../src/lib/prisma', () => {
  const db = {
    hacker: { findUnique: jest.fn() },
    chapterMembership: { findFirst: jest.fn() },
    event: { findUnique: jest.fn() },
    judgingTrack: { findMany: jest.fn() },
    judgingCriterion: { findMany: jest.fn() },
    judgingSubmission: { findMany: jest.fn() },
    $transaction: jest.fn(),
  };
  db.$transaction.mockImplementation(operation => operation(db));
  return { __esModule: true, default: db };
});
const db = require('../../src/lib/prisma').default;
const request = new Request(
  'https://sundai.club/api/events/event-1/judging/export'
);
const context = { params: Promise.resolve({ eventId: 'event-1' }) };
const event = {
  id: 'event-1',
  chapterId: 'chapter-1',
  title: 'Demo Day',
  slug: 'demo-day',
  staff: [{ role: 'MC' }],
  judgingEnabled: true,
  judgingOpen: true,
  judgesPerProject: 3,
};
const member = { id: 'lead-1', name: 'Alice', email: 'alice@example.com' };
const submissions = [
  {
    id: 'submission-1',
    trackId: 'track-1',
    answersJson: {
      question: '=1+1',
      removed: 'Preserved answer',
      additionalInfo: 'More details',
    },
    project: {
      id: 'project-1',
      title: 'Scored project',
      githubUrl: 'https://github.com/example/project',
      launchLead: member,
      participants: [
        { hacker: member },
        { hacker: { id: 'member-2', name: 'Bob', email: null } },
      ],
    },
    _count: { assignments: 3 },
    reviews: [
      {
        judgeId: 'judge-1',
        comment: null,
        judge: { name: 'Judge', email: 'judge@example.com' },
        scores: [{ criterionId: 'criterion-1', score: 8 }],
      },
    ],
  },
  {
    id: 'submission-2',
    trackId: 'track-2',
    answersJson: { question: 'Different track answer' },
    project: {
      id: 'project-2',
      title: 'Unscored project',
      githubUrl: null,
      launchLead: member,
      participants: [],
    },
    _count: { assignments: 0 },
    reviews: [],
  },
];

beforeEach(() => {
  jest.clearAllMocks();
  mockAuth.mockResolvedValue({ userId: 'clerk-mc' });
  db.hacker.findUnique.mockResolvedValue({ id: 'organizer', role: 'HACKER' });
  db.event.findUnique.mockResolvedValue(event);
  db.chapterMembership.findFirst.mockResolvedValue(null);
  db.judgingTrack.findMany.mockResolvedValue([
    {
      id: 'track-1',
      name: 'Healthcare',
      questionsJson: [
        { id: 'question', prompt: 'What did you build?', required: true },
      ],
    },
    {
      id: 'track-2',
      name: 'Robotics',
      questionsJson: [
        { id: 'question', prompt: 'What did you build?', required: true },
      ],
    },
  ]);
  db.judgingCriterion.findMany.mockResolvedValue([
    { id: 'criterion-1', trackId: null, name: 'Impact', weight: 1 },
  ]);
  db.judgingSubmission.findMany.mockResolvedValue(submissions);
});

async function download() {
  const response = await GET(request, context);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from((response as any).body));
  return { response, workbook, sheet: workbook.getWorksheet('Leaderboard')! };
}

it('requires authentication before reading judging data', async () => {
  mockAuth.mockResolvedValue({ userId: null });
  expect((await GET(request, context)).status).toBe(401);
  expect(db.$transaction).not.toHaveBeenCalled();
});

it.each([
  ['co-MC', [{ role: 'CO_MC' }], null],
  ['attendee or judge', [], null],
  ['chapter member', [], { role: 'MEMBER', status: 'ACTIVE' }],
  ['inactive admin', [], { role: 'ADMIN', status: 'INVITED' }],
])('blocks a direct download by a %s', async (_role, staff, membership) => {
  db.event.findUnique.mockResolvedValue({ ...event, staff });
  db.chapterMembership.findFirst.mockResolvedValue(membership);
  expect((await GET(request, context)).status).toBe(403);
  expect(db.$transaction).not.toHaveBeenCalled();
});

it.each([
  ['MC', 'HACKER', [{ role: 'MC' }], null],
  ['site admin', 'SITE_ADMIN', [], null],
  ['chapter admin', 'HACKER', [], { role: 'ADMIN', status: 'ACTIVE' }],
])('allows a download by a %s', async (_role, role, staff, membership) => {
  db.hacker.findUnique.mockResolvedValue({ id: 'organizer', role });
  db.event.findUnique.mockResolvedValue({ ...event, staff });
  db.chapterMembership.findFirst.mockResolvedValue(membership);
  const { response } = await download();
  expect(response.status).toBe(200);
  expect(db.chapterMembership.findFirst).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { chapterId: event.chapterId, hackerId: 'organizer' },
    })
  );
});

it('exports scores, track-specific questions, answers, links and team emails in a private snapshot', async () => {
  const { response, workbook, sheet } = await download();
  expect(response.headers.get('Content-Type')).toBe(
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  expect(response.headers.get('Content-Disposition')).toBe(
    'attachment; filename="demo-day-judging-results.xlsx"'
  );
  expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
  expect(sheet.getRow(1).values).toEqual([
    undefined,
    'Rank',
    'Project name',
    'Track',
    'Final score',
    'Healthcare: What did you build?',
    'Robotics: What did you build?',
    'Healthcare: Saved question (removed)',
    'Additional info',
    'GitHub URL',
    'Sundai Club URL',
    'Team members',
    'Completed reviews',
  ]);
  expect(sheet.getCell('D2').value).toBe(8);
  expect(sheet.getCell('D2').numFmt).toBe('0.00');
  expect(sheet.getCell('D3').value).toBeNull();
  expect(sheet.getCell('E2').value).toBe('=1+1');
  expect(sheet.getCell('E2').type).toBe(ExcelJS.ValueType.String);
  expect(sheet.getCell('F2').value).toBeNull();
  expect(sheet.getCell('E3').value).toBeNull();
  expect(sheet.getCell('F3').value).toBe('Different track answer');
  expect(sheet.getCell('G2').value).toBe('Preserved answer');
  expect(sheet.getCell('H2').value).toBe('More details');
  expect(sheet.getCell('I2').value).toEqual({
    text: submissions[0].project.githubUrl,
    hyperlink: submissions[0].project.githubUrl,
  });
  expect(sheet.getCell('J2').value).toEqual({
    text: expect.stringMatching(/\/projects\/project-1$/),
    hyperlink: expect.stringMatching(/\/projects\/project-1$/),
  });
  expect(sheet.getCell('K2').value).toBe(
    'Alice (alice@example.com)\nBob (Email not on file)'
  );
  expect(sheet.getCell('L2').value).toBe(1);
  expect(sheet.views[0]).toMatchObject({
    state: 'frozen',
    xSplit: 2,
    ySplit: 1,
  });
  expect(sheet.autoFilter).toBeDefined();
  expect(workbook.getWorksheet('Export details')!.getCell('B4').value).toBe(
    true
  );
  expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), {
    isolationLevel: 'RepeatableRead',
    timeout: 15000,
  });
  for (const [query] of db.judgingSubmission.findMany.mock.calls) {
    expect(query.where).toMatchObject({
      eventId: event.id,
      project: {
        status: 'APPROVED',
        eventParticipations: { some: { eventId: event.id } },
        launchLead: { userBans: { none: { revokedAt: null } } },
      },
    });
    expect(query.take).toBeUndefined();
  }
});

it.each([
  [false, false],
  [true, false],
  [true, true],
])(
  'exports before, during and after scoring (enabled=%s, open=%s)',
  async (judgingEnabled, judgingOpen) => {
    db.event.findUnique.mockResolvedValue({
      ...event,
      judgingEnabled,
      judgingOpen,
    });
    db.judgingSubmission.findMany.mockResolvedValue([]);
    const { response, sheet } = await download();
    expect(response.status).toBe(200);
    expect(sheet.rowCount).toBe(1);
    expect(sheet.getCell('E1').value).toBe('Healthcare: What did you build?');
  }
);

it('does not paginate the export', async () => {
  db.judgingSubmission.findMany.mockResolvedValue(
    Array.from({ length: 254 }, (_, i) => ({
      ...submissions[0],
      id: `submission-${i}`,
      project: {
        ...submissions[0].project,
        id: `project-${i}`,
        title: `Project ${i}`,
      },
    }))
  );
  expect((await download()).sheet.rowCount).toBe(255);
});

it('uses the normalized leaderboard score rather than the raw review average', async () => {
  db.judgingSubmission.findMany.mockResolvedValue([
    submissions[0],
    {
      ...submissions[1],
      reviews: [
        {
          judgeId: 'judge-2',
          comment: null,
          judge: { name: 'Second judge', email: 'second@example.com' },
          scores: [{ criterionId: 'criterion-1', score: 4 }],
        },
      ],
    },
  ]);
  const { sheet } = await download();
  // Each judge has only one review, so both normalize to the pooled mean.
  expect(sheet.getCell('B2').value).toBe('Scored project');
  expect(sheet.getCell('D2').value).toBe(6);
  expect(sheet.getCell('D3').value).toBe(6);
});

it('returns not found without exporting when the event does not exist', async () => {
  db.event.findUnique.mockResolvedValue(null);
  expect((await GET(request, context)).status).toBe(404);
  expect(db.$transaction).not.toHaveBeenCalled();
});

it('returns an error instead of a partial file when the snapshot fails', async () => {
  db.$transaction.mockRejectedValueOnce(new Error('Database unavailable'));
  expect((await GET(request, context)).status).toBe(500);
});
