import fs from 'fs';
import path from 'path';

const rootDir = path.resolve(__dirname, '../..');
const schema = fs.readFileSync(path.join(rootDir, 'prisma/schema.prisma'), 'utf8');
const migration = fs.readFileSync(
  path.join(
    rootDir,
    'prisma/migrations/20260720020000_event_project_participation/migration.sql'
  ),
  'utf8'
);

describe('event project participation cutover', () => {
  it('makes EventProject the unique event participation record', () => {
    expect(schema).toMatch(/model EventProject\s*{/);
    expect(schema).toContain('@@unique([eventId, projectId])');
    expect(migration).toContain('CREATE TABLE "EventProject"');
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "EventProject_eventId_projectId_key"'
    );
  });

  it('backfills pitch-linked projects before removing pitch card state', () => {
    const backfill = migration.indexOf('INSERT INTO "EventProject"');
    const drop = migration.indexOf(
      'ALTER TABLE "PitchProject" DROP COLUMN "cardStatus"'
    );

    expect(backfill).toBeGreaterThan(-1);
    expect(drop).toBeGreaterThan(backfill);
    expect(migration).toContain(
      'JOIN "PitchSession" session ON session."id" = entry."pitchSessionId"'
    );
  });
});
