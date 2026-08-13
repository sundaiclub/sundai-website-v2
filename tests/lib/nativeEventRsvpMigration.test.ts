import fs from 'fs';
import path from 'path';

const rootDir = path.resolve(__dirname, '../..');
const schemaPath = path.join(rootDir, 'prisma/schema.prisma');
const migrationPath = path.join(
  rootDir,
  'prisma/migrations/20260622000000_native_event_rsvp/migration.sql'
);

const schema = fs.readFileSync(schemaPath, 'utf8');
const migration = fs.readFileSync(migrationPath, 'utf8');

const readBlock = (source: string, kind: 'enum' | 'model', name: string) => {
  const match = source.match(
    new RegExp(`\\b${kind}\\s+${name}\\s*{([\\s\\S]*?)\\n}`)
  );

  if (!match) {
    throw new Error(`Could not find ${kind} ${name}`);
  }

  return match[1];
};

const normalizeSql = (sql: string) => sql.replace(/\s+/g, ' ').trim();
const expectSql = (snippet: string) => {
  expect(normalizeSql(migration)).toContain(normalizeSql(snippet));
};

describe('native event RSVP migration', () => {
  it('removes placeholder event application modes from the Prisma schema', () => {
    const applicationModeEnum = readBlock(
      schema,
      'enum',
      'EventApplicationMode'
    );

    expect(applicationModeEnum).toContain('REQUIRES_APPROVAL');
    expect(applicationModeEnum).toContain('OPEN_RSVP');
    expect(applicationModeEnum).not.toMatch(/^\s*NONE\s*$/m);
    expect(applicationModeEnum).not.toMatch(/^\s*INTERNAL\s*$/m);
    expect(applicationModeEnum).not.toMatch(/^\s*PUBLIC_LATER\s*$/m);
  });

  it('preserves legacy application-mode semantics before rebuilding the enum', () => {
    expectSql(`
      ALTER TABLE "Event" ADD COLUMN "legacyApplicationMode" TEXT;
    `);
    expectSql(`
      UPDATE "Event" SET "legacyApplicationMode" = "applicationMode"::text;
    `);
    expectSql(`
      SET "applicationsOpen" = (
        "legacyApplicationMode" = 'PUBLIC_LATER'
        OR "legacyApplicationsOpenAt" IS NOT NULL
      );
    `);
    expectSql(`
      ALTER TABLE "Event"
        DROP COLUMN "legacyApplicationMode",
        DROP COLUMN "legacyApplicationsOpenAt";
    `);
  });

  it('maps public registration source data without retaining PUBLIC_LATER', () => {
    const registrationSourceEnum = readBlock(
      schema,
      'enum',
      'EventRegistrationSource'
    );

    expect(registrationSourceEnum).toContain('INTERNAL');
    expect(registrationSourceEnum).toContain('WEBSITE');
    expect(registrationSourceEnum).toContain('IMPORT');
    expect(registrationSourceEnum).not.toMatch(/^\s*PUBLIC_LATER\s*$/m);
    expectSql(`
      WHEN 'PUBLIC_LATER' THEN 'WEBSITE'
    `);
  });
});
