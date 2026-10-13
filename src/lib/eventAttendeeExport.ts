import ExcelJS from 'exceljs';
import type { Prisma } from '@prisma/client';
import type { TemplateFieldDefinition } from '@/types/event-management';

export const attendeeExportSelect = {
  answersJson: true,
  templateSnapshotJson: true,
  status: true,
  submittedAt: true,
  decidedAt: true,
  hacker: { select: { name: true, email: true, phoneNumber: true } },
  decidedBy: { select: { name: true } },
} satisfies Prisma.EventRegistrationSelect;

type ExportRegistration = Prisma.EventRegistrationGetPayload<{
  select: typeof attendeeExportSelect;
}>;

function object(value: Prisma.JsonValue | null): Prisma.JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {};
}

// Read each saved definition independently so an older or incomplete snapshot
// cannot remove another field or discard its answer.
function fields(value: Prisma.JsonValue | null): TemplateFieldDefinition[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (field): field is Prisma.JsonObject =>
      !!field &&
      typeof field === 'object' &&
      !Array.isArray(field) &&
      typeof field.id === 'string' &&
      typeof field.label === 'string'
  ) as unknown as TemplateFieldDefinition[];
}

function cellValue(value: Prisma.JsonValue | undefined): ExcelJS.CellValue {
  if (value == null) return null;
  return typeof value === 'object' ? JSON.stringify(value) : value;
}

export async function createAttendeeWorkbook(
  event: { title: string; applicationQuestionsJson: Prisma.JsonValue | null },
  registrations: ExportRegistration[]
) {
  const definitions = new Map<string, TemplateFieldDefinition>();
  for (const registration of registrations) {
    for (const field of fields(registration.templateSnapshotJson)) {
      if (!definitions.has(field.id)) definitions.set(field.id, field);
    }
  }
  for (const field of fields(event.applicationQuestionsJson)) {
    if (!definitions.has(field.id)) definitions.set(field.id, field);
  }
  for (const registration of registrations) {
    for (const id of Object.keys(object(registration.answersJson))) {
      if (!definitions.has(id)) {
        definitions.set(id, { id, label: id, type: 'TEXT', required: false });
      }
    }
  }
  const questions = Array.from(definitions.values());
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Sundai';
  workbook.created = new Date();
  const sheet = workbook.addWorksheet('Accepted attendees', {
    views: [{ state: 'frozen', ySplit: 1, xSplit: 1, showGridLines: false }],
  });
  const headers = [
    'Account name',
    'Account email',
    'Account phone',
    ...questions.map(field => field.label),
    'Status',
    'Submitted (UTC)',
    'Accepted (UTC)',
    'Accepted by',
  ];
  sheet.columns = headers.map(header => ({
    header,
    width: header.length > 60 ? 80 : 35,
  }));
  for (const registration of registrations) {
    const answers = object(registration.answersJson);
    sheet.addRow([
      registration.hacker.name,
      registration.hacker.email,
      registration.hacker.phoneNumber,
      ...questions.map(field => cellValue(answers[field.id])),
      registration.status,
      registration.submittedAt,
      registration.decidedAt,
      registration.decidedBy?.name ?? null,
    ]);
  }
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: headers.length },
  };
  sheet.eachRow(row => {
    row.alignment = { vertical: 'top', wrapText: true };
    row.font = { name: 'Arial', size: 10 };
    let lines = 1;
    row.eachCell((cell, column) => {
      if (typeof cell.value !== 'string') return;
      const width = sheet.getColumn(column).width ?? 35;
      lines = Math.max(
        lines,
        cell.value
          .split('\n')
          .reduce(
            (total, line) =>
              total + Math.max(1, Math.ceil(line.length / (width * 0.8))),
            0
          )
      );
    });
    row.height =
      row.number === 1 ? 60 : Math.min(409, Math.max(30, lines * 15 + 10));
  });
  sheet.getRow(1).eachCell(cell => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF253D5B' },
    };
    cell.font = {
      name: 'Arial',
      size: 10,
      bold: true,
      color: { argb: 'FFFFFFFF' },
    };
  });
  sheet.getColumn(3).numFmt = '@';
  questions.forEach((field, index) => {
    if (field.type === 'PHONE') sheet.getColumn(index + 4).numFmt = '@';
  });
  sheet.getColumn(headers.length - 2).numFmt = 'mm/dd/yyyy hh:mm';
  sheet.getColumn(headers.length - 1).numFmt = 'mm/dd/yyyy hh:mm';

  const guide = workbook.addWorksheet('Application fields', {
    views: [{ showGridLines: false }],
  });
  guide.addRow([event.title]);
  guide.addRow([
    'Source: Current accepted event applications. Blank answers mean no saved value. Dates use UTC.',
  ]);
  guide.addRow([
    'Field ID',
    'Question label',
    'Type',
    'Required',
    'Help text',
    'Options',
    'Saved answer count',
  ]);
  for (const field of questions) {
    guide.addRow([
      field.id,
      field.label,
      field.type,
      field.required ?? null,
      field.helpText ?? null,
      field.options ? JSON.stringify(field.options) : null,
      registrations.filter(r => object(r.answersJson)[field.id] != null).length,
    ]);
  }
  guide.columns.forEach(column => {
    column.width = 40;
  });
  guide.eachRow(row => {
    row.alignment = { vertical: 'top', wrapText: true };
    row.font = { name: 'Arial', size: 10 };
    let lines = 1;
    row.eachCell(cell => {
      if (typeof cell.value === 'string')
        lines = Math.max(lines, Math.ceil(cell.value.length / 30));
    });
    row.height = Math.min(409, Math.max(30, lines * 15 + 10));
  });
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}

export function attendeeExportFilename(slug: string) {
  const safeSlug =
    slug.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 120) || 'event';
  return `${safeSlug}-accepted-attendees.xlsx`;
}
