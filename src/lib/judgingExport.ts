import ExcelJS from 'exceljs';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import {
  JudgingError,
  judgeableSubmissionWhere,
  loadJudgingResults,
} from '@/lib/judgingData';
import { parseJudgingAnswers, parseJudgingQuestions } from '@/lib/judging';
import { publicUrl } from '@/lib/siteUrl';
import { ADDITIONAL_INFO_KEY } from '@/types/judging';

export async function loadJudgingExport(eventId: string) {
  // Keep scores, answers and team details from the same database snapshot.
  return prisma.$transaction(
    async db => {
      const [event, results, tracks, submissions] = await Promise.all([
        db.event.findUnique({
          where: { id: eventId },
          select: {
            title: true,
            slug: true,
            judgingEnabled: true,
            judgingOpen: true,
          },
        }),
        loadJudgingResults(eventId, db),
        db.judgingTrack.findMany({
          where: { eventId },
          orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
          select: { id: true, name: true, questionsJson: true },
        }),
        db.judgingSubmission.findMany({
          where: judgeableSubmissionWhere(eventId),
          select: {
            id: true,
            trackId: true,
            answersJson: true,
            project: {
              select: {
                githubUrl: true,
                launchLead: { select: { id: true, name: true, email: true } },
                participants: {
                  select: {
                    hacker: { select: { id: true, name: true, email: true } },
                  },
                },
              },
            },
          },
          orderBy: { id: 'asc' },
        }),
      ]);
      if (!event) throw new JudgingError('Event not found.', 404);
      return { event, results, tracks, submissions, exportedAt: new Date() };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
      timeout: 15000,
    }
  );
}

type JudgingExport = Awaited<ReturnType<typeof loadJudgingExport>>;

function questionColumns(data: JudgingExport) {
  const columns = new Map<
    string,
    { trackId: string; id: string; label: string }
  >();
  for (const track of data.tracks) {
    for (const question of parseJudgingQuestions(track.questionsJson)) {
      columns.set(JSON.stringify([track.id, question.id]), {
        trackId: track.id,
        id: question.id,
        label: `${track.name}: ${question.prompt}`,
      });
    }
  }
  // Keep saved answers even if their question has since been removed.
  for (const submission of data.submissions) {
    for (const id of Object.keys(parseJudgingAnswers(submission.answersJson))) {
      const key = JSON.stringify([submission.trackId, id]);
      if (id === ADDITIONAL_INFO_KEY || columns.has(key)) continue;
      const track = data.tracks.find(item => item.id === submission.trackId)!;
      columns.set(key, {
        trackId: submission.trackId,
        id,
        label: `${track.name}: Saved question (${id})`,
      });
    }
  }
  return Array.from(columns.values());
}

function hyperlink(url: string | null): ExcelJS.CellValue {
  if (!url) return null;
  return /^https?:\/\//i.test(url) ? { text: url, hyperlink: url } : url;
}

export async function createJudgingWorkbook(data: JudgingExport) {
  const questions = questionColumns(data);
  const submissions = new Map(data.submissions.map(item => [item.id, item]));
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Sundai';
  workbook.created = data.exportedAt;
  const sheet = workbook.addWorksheet('Leaderboard', {
    views: [{ state: 'frozen', ySplit: 1, xSplit: 2, showGridLines: false }],
  });
  const headers = [
    'Rank',
    'Project name',
    'Track',
    'Final score',
    ...questions.map(question => question.label),
    'Additional info',
    'GitHub URL',
    'Sundai Club URL',
    'Team members',
    'Completed reviews',
  ];
  const widths = [
    7,
    35,
    22,
    14,
    ...questions.map(() => 60),
    60,
    48,
    48,
    70,
    22,
  ];
  sheet.columns = headers.map((header, index) => ({
    header,
    width: widths[index],
  }));
  data.results.overall.forEach((result, index) => {
    const submission = submissions.get(result.submissionId)!;
    const answers = parseJudgingAnswers(submission.answersJson);
    const members = new Map(
      [
        submission.project.launchLead,
        ...submission.project.participants.map(p => p.hacker),
      ].map(member => [member.id, member])
    );
    sheet.addRow([
      index + 1,
      result.title,
      result.trackName,
      result.normalizedScore,
      ...questions.map(question =>
        question.trackId === submission.trackId
          ? (answers[question.id] ?? null)
          : null
      ),
      answers[ADDITIONAL_INFO_KEY] ?? null,
      hyperlink(submission.project.githubUrl),
      hyperlink(publicUrl(`/projects/${result.projectId}`)),
      Array.from(members.values())
        .sort(
          (a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id)
        )
        .map(
          member => `${member.name} (${member.email || 'Email not on file'})`
        )
        .join('\n'),
      result.judgeCount,
    ]);
  });
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: headers.length },
  };
  sheet.eachRow(row => {
    row.font = { name: 'Arial', size: 10 };
    row.alignment = { vertical: 'top', wrapText: true };
    let lines = 1;
    row.eachCell((cell, column) => {
      const text = typeof cell.value === 'string' ? cell.value : cell.text;
      const width = widths[column - 1];
      lines = Math.max(
        lines,
        text
          .split('\n')
          .reduce(
            (total, line) =>
              total + Math.max(1, Math.ceil(line.length / (width * 0.8))),
            0
          )
      );
      if (cell.type === ExcelJS.ValueType.Hyperlink) {
        cell.font = {
          name: 'Arial',
          size: 10,
          color: { argb: 'FF1D4ED8' },
          underline: true,
        };
      }
    });
    row.height = Math.min(
      409,
      Math.max(row.number === 1 ? 60 : 30, lines * 15 + 10)
    );
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
  sheet.getColumn(4).numFmt = '0.00';

  const details = workbook.addWorksheet('Export details', {
    views: [{ showGridLines: false }],
  });
  details.columns = [{ width: 24 }, { width: 110 }];
  details.addRows([
    ['Event', data.event.title],
    ['Exported (UTC)', data.exportedAt],
    ['Judging enabled', data.event.judgingEnabled],
    ['Scoring open', data.event.judgingOpen],
    [
      'Source',
      'Current event judging leaderboard, saved submission answers and project team records.',
    ],
    [
      'Final score',
      'Current normalized score, as shown on the judging page. Only complete reviews count. Normalized scores can fall outside 1-10.',
    ],
    [
      'Missing scores',
      'Blank scores mean no complete reviews. Projects without scores appear last.',
    ],
    [
      'Questions',
      'Question columns are labeled by track. Blank answers mean no saved value or a question from another track. Saved question IDs identify answers whose question was removed.',
    ],
    [
      'Team members',
      'Includes the project lead and participants, once per account, with their saved email addresses.',
    ],
  ]);
  details.getCell('B2').numFmt = 'yyyy-mm-dd hh:mm:ss';
  details.eachRow(row => {
    row.font = { name: 'Arial', size: 10 };
    row.alignment = { vertical: 'top', wrapText: true };
    row.height = 45;
    row.getCell(1).font = { name: 'Arial', size: 10, bold: true };
  });
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}

export function judgingExportFilename(slug: string) {
  const safeSlug =
    slug.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 120) || 'event';
  return `${safeSlug}-judging-results.xlsx`;
}
