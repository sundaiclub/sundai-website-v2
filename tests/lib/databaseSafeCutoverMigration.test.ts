import fs from 'fs';
import path from 'path';

const rootDir = path.resolve(__dirname, '../..');
const schema = fs.readFileSync(
  path.join(rootDir, 'prisma/schema.prisma'),
  'utf8'
);
const migration = fs.readFileSync(
  path.join(
    rootDir,
    'prisma/migrations/20260713000000_align_pitch_session_legacy_default/migration.sql'
  ),
  'utf8'
);

const normalizeSql = (sql: string) => sql.replace(/\s+/g, ' ').trim();

describe('database-safe legacy default cutover', () => {
  it('aligns the database default without modifying historical pitch-session rows', () => {
    const pitchSessionModel = schema.match(
      /\bmodel\s+PitchSession\s*{([\s\S]*?)\n}/
    )?.[1];

    expect(pitchSessionModel).toBeDefined();
    expect(normalizeSql(pitchSessionModel ?? '')).toContain(
      'legacyBackfill Boolean @default(false)'
    );
    expect(normalizeSql(migration)).toContain(
      'ALTER TABLE "PitchSession" ALTER COLUMN "legacyBackfill" SET DEFAULT false;'
    );

    expect(migration).not.toMatch(/\b(?:UPDATE|DELETE|DROP|TRUNCATE)\b/i);
  });
});
