import fs from 'node:fs';
import path from 'node:path';

type HistoricalEvent = {
  sourceId: string;
  sourceUrl: string;
  title: string;
  description: string | null;
  startDate: string;
  endDate: string | null;
  timezone: string;
  location: string | null;
  image: { url: string };
};

const repositoryRoot = path.resolve(__dirname, '../..');
const manifestPath = path.join(
  repositoryRoot,
  'prisma/data/sundai-boston-partiful-events.json'
);
const migrationPath = path.join(
  repositoryRoot,
  'prisma/data-migrations/20260807000000_backfill_sundai_boston_events.ts'
);
const imageDirectory = path.join(
  repositoryRoot,
  'prisma/data/sundai-boston-event-images'
);

const events = JSON.parse(
  fs.readFileSync(manifestPath, 'utf8')
) as HistoricalEvent[];
const migration = fs.readFileSync(migrationPath, 'utf8');

function localDate(event: HistoricalEvent) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: event.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(event.startDate));
}

describe('Sundai Boston historical event data migration', () => {
  it('contains one Sunday main hack per date and excludes parallel/research events', () => {
    expect(events).toHaveLength(71);
    expect(new Set(events.map(event => event.sourceId)).size).toBe(
      events.length
    );
    expect(new Set(events.map(localDate)).size).toBe(events.length);

    for (const event of events) {
      expect(
        new Intl.DateTimeFormat('en-US', {
          timeZone: event.timezone,
          weekday: 'long',
        }).format(new Date(event.startDate))
      ).toBe('Sunday');
      expect(event.title).not.toMatch(/\b(retreat|research)\b/i);
      expect(event.sourceUrl).toBe(`https://partiful.com/e/${event.sourceId}`);
      expect(event.description).not.toBeNull();
      expect(event.image.url).toMatch(/^https:\/\//);
      expect(event.image.url).not.toContain('token=');
    }
  });

  it('checks in exactly one supported image for each event', () => {
    const filenames = fs
      .readdirSync(imageDirectory)
      .filter(filename => !filename.startsWith('.'));
    expect(filenames).toHaveLength(events.length);

    for (const event of events) {
      const matches = filenames.filter(filename =>
        filename.startsWith(`${event.sourceId}.`)
      );
      expect(matches).toHaveLength(1);
      expect(matches[0]).toMatch(/\.(gif|jpe?g|png|webp)$/);
      expect(
        fs.statSync(path.join(imageDirectory, matches[0])).size
      ).toBeGreaterThan(0);
    }
  });

  it('uploads deterministic GCS objects and links same-day pitch projects idempotently', () => {
    expect(migration).toContain("const PUBLIC_LOCATION = 'Boston, MA'");
    expect(migration).toContain(
      "const IMAGE_FOLDER = 'events/historical/partiful'"
    );
    expect(migration).toContain('await tx.image.upsert');
    expect(migration).toContain('await tx.event.upsert');
    expect(migration).toContain('await tx.eventProject.upsert');
    expect(migration).toContain('startTime: { gte: start, lt: end }');
    expect(migration).toContain('data: { eventId, legacyBackfill: false }');
    expect(migration).toContain('cardStatus: EventProjectCardStatus.APPROVED');
    expect(migration).toContain('approvedDetailsJson');
    expect(migration).not.toContain('publicProgramLabel');
    expect(migration).not.toContain('What to expect');
  });
});
