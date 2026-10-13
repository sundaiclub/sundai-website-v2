/** @jest-environment-options {"customExportConditions": ["node", "node-addons"]} */
import ExcelJS from 'exceljs';
import { NextResponse } from 'next/server';
import { GET } from '../../src/app/api/events/[eventId]/registrations/export/route';

const mockAccess = jest.fn();
const mockFindMany = jest.fn();
jest.mock('../../src/lib/eventManagementApi', () => ({
  requireEventRegistrationManager: (...args: unknown[]) => mockAccess(...args),
  isSiteAdmin: (hacker: { role: string }) => hacker.role === 'ADMIN',
}));
jest.mock('../../src/lib/prisma', () => ({
  __esModule: true,
  default: {
    eventRegistration: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}));

const field = {
  id: 'university',
  label: 'University / College',
  type: 'TEXT',
  required: true,
};
const registration = {
  status: 'APPROVED',
  submittedAt: new Date('2026-10-01T12:00:00Z'),
  decidedAt: new Date('2026-10-02T12:00:00Z'),
  hacker: {
    name: 'Account name',
    email: 'account@example.com',
    phoneNumber: '+15551234567',
  },
  decidedBy: { name: 'Organizer' },
  answersJson: {
    name: 'Submitted name',
    university: '=HYPERLINK("https://example.com")',
    legacy: ['one', 'two'],
  },
  templateSnapshotJson: [
    { id: 'name', label: 'Full legal name', type: 'TEXT', required: true },
    field,
  ],
};
const context = { params: { eventId: 'event-1' } };
const request = new Request(
  'https://sundai.club/api/events/event-1/registrations/export'
);
const access = (role = 'HACKER') => ({
  response: null,
  hacker: { id: 'organizer', role },
  event: {
    title: 'Test event',
    slug: 'test-event',
    applicationQuestionsJson: [field],
  },
});

describe('accepted attendee download', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAccess.mockResolvedValue(access());
    mockFindMany.mockResolvedValue([registration]);
  });

  it.each([401, 403, 404])(
    'does not query attendees when the access check returns %i',
    async status => {
      mockAccess.mockResolvedValue({
        response: NextResponse.json({ error: 'Denied' }, { status }),
      });
      expect((await GET(request, context)).status).toBe(status);
      expect(mockFindMany).not.toHaveBeenCalled();
    }
  );

  it('exports every approved applicant with saved labels, contact fields and dates as a private Excel download', async () => {
    mockFindMany.mockResolvedValue([
      ...Array.from({ length: 238 }, () => registration),
      {
        ...registration,
        answersJson: null,
        templateSnapshotJson: null,
        decidedAt: null,
        decidedBy: null,
      },
    ]);
    const response = await GET(request, context);
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Disposition')).toBe(
      'attachment; filename="test-event-accepted-attendees.xlsx"'
    );
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    const query = mockFindMany.mock.calls[0][0];
    expect(query.where).toEqual({
      eventId: 'event-1',
      status: 'APPROVED',
      cancelledAt: null,
      hacker: { userBans: { none: { revokedAt: null } } },
    });
    expect(query.take).toBeUndefined();
    expect(query.select).not.toHaveProperty('internalReviewNotes');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.from((response as any).body));
    const sheet = workbook.getWorksheet('Accepted attendees')!;
    expect(sheet.rowCount).toBe(240);
    expect(sheet.getRow(1).values).toEqual([
      undefined,
      'Account name',
      'Account email',
      'Account phone',
      'Full legal name',
      'University / College',
      'legacy',
      'Status',
      'Submitted (UTC)',
      'Accepted (UTC)',
      'Accepted by',
    ]);
    expect(sheet.getCell('C2').value).toBe('+15551234567');
    expect(sheet.getCell('D2').value).toBe('Submitted name');
    expect(sheet.getCell('E2').value).toBe(registration.answersJson.university);
    expect(sheet.getCell('E2').type).toBe(ExcelJS.ValueType.String);
    expect(sheet.getCell('F2').value).toBe('["one","two"]');
    expect(sheet.getCell('H2').value).toEqual(registration.submittedAt);
    expect(sheet.getCell('D240').value).toBeNull();
    expect(sheet.getCell('A240').value).toBe('Account name');
  });

  it('keeps site admin ban visibility consistent with registration review', async () => {
    mockAccess.mockResolvedValue(access('ADMIN'));
    await GET(request, context);
    expect(mockFindMany.mock.calls[0][0].where).not.toHaveProperty('hacker');
  });

  it('returns an Excel file with column headers when there are no accepted applicants', async () => {
    mockFindMany.mockResolvedValue([]);
    const response = await GET(request, context);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.from((response as any).body));
    const sheet = workbook.getWorksheet('Accepted attendees')!;
    expect(sheet.rowCount).toBe(1);
    expect(sheet.getRow(1).getCell(sheet.columnCount).value).toBe(
      'Accepted by'
    );
  });
});
