import fs from 'fs';
import path from 'path';

const rootDir = path.resolve(__dirname, '../..');
const schemaPath = path.join(rootDir, 'prisma/schema.prisma');
const migrationPath = path.join(
  rootDir,
  'prisma/migrations/20260525000000_event_management_foundations/migration.sql'
);

const schema = fs.readFileSync(schemaPath, 'utf8');
const migration = fs.readFileSync(migrationPath, 'utf8');
const eventTimezoneMigration = fs.readFileSync(
  path.join(
    rootDir,
    'prisma/migrations/20260806020000_add_event_timezone/migration.sql'
  ),
  'utf8'
);
const siteApplicationTemplateMigration = fs.readFileSync(
  path.join(
    rootDir,
    'prisma/migrations/20260721020000_ensure_active_site_application_template/migration.sql'
  ),
  'utf8'
);

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
const expectSchemaLine = (block: string, fields: string[]) => {
  expect(normalizeSql(block)).toContain(fields.join(' '));
};

describe('event management foundation migration', () => {
  it('creates a system template creator on a clean database without users', () => {
    const normalizedMigration = normalizeSql(siteApplicationTemplateMigration);

    expect(normalizedMigration).toContain(
      normalizeSql(`
        WHERE "role" = 'SITE_ADMIN'
        ORDER BY "createdAt" ASC, "id" ASC
        LIMIT 1;
      `)
    );
    expect(normalizedMigration).toContain(
      normalizeSql(`
        INSERT INTO "Hacker" (
          "id",
          "clerkId",
          "name",
          "role",
          "createdAt",
          "updatedAt"
        ) VALUES (
          gen_random_uuid()::text,
          'system_default_site_application_template_creator',
          'System application template creator',
          'NOT_SET',
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
        ON CONFLICT ("clerkId") DO NOTHING;
      `)
    );
    expect(normalizedMigration).toContain(
      normalizeSql(`
        WHERE "clerkId" = 'system_default_site_application_template_creator';
      `)
    );
  });

  it('stores an event timezone and backfills existing events from their chapters', () => {
    const eventModel = readBlock(schema, 'model', 'Event');
    const normalizedMigration = normalizeSql(eventTimezoneMigration);

    expectSchemaLine(eventModel, ['timezone', 'String']);
    expect(normalizedMigration).toContain(
      normalizeSql('ALTER TABLE "Event" ADD COLUMN "timezone" TEXT;')
    );
    expect(normalizedMigration).toContain(
      normalizeSql(`
        UPDATE "Event"
        SET "timezone" = "Chapter"."timezone"
        FROM "Chapter"
        WHERE "Event"."chapterId" = "Chapter"."id";
      `)
    );
    expect(normalizedMigration).toContain(
      normalizeSql('ALTER TABLE "Event" ALTER COLUMN "timezone" SET NOT NULL;')
    );
  });

  it('cuts Role.ADMIN over to Role.SITE_ADMIN without keeping ADMIN in the Role schema enum', () => {
    const roleEnum = readBlock(schema, 'enum', 'Role');

    expect(roleEnum).toContain('SITE_ADMIN');
    expect(roleEnum).not.toMatch(/^\s*ADMIN\s*$/m);

    expectSql(`
      ALTER TYPE "Role" RENAME VALUE 'ADMIN' TO 'SITE_ADMIN';
    `);
    expectSql(`
      ALTER TYPE "Role" ADD VALUE 'SITE_ADMIN';
    `);
  });

  it('backfills the Boston chapter and attaches legacy pitch sessions to it', () => {
    const chapterModel = readBlock(schema, 'model', 'Chapter');
    const eventModel = readBlock(schema, 'model', 'Event');
    const pitchSessionModel = readBlock(schema, 'model', 'PitchSession');

    expectSchemaLine(chapterModel, ['slug', 'String', '@unique']);
    expectSchemaLine(chapterModel, ['timezone', 'String']);
    expectSchemaLine(eventModel, [
      'chapter',
      'Chapter',
      '@relation(fields:',
      '[chapterId],',
      'references:',
      '[id])',
    ]);
    expectSchemaLine(eventModel, ['chapterId', 'String']);
    expectSchemaLine(pitchSessionModel, [
      'chapter',
      'Chapter',
      '@relation(fields:',
      '[chapterId],',
      'references:',
      '[id])',
    ]);
    expectSchemaLine(pitchSessionModel, ['chapterId', 'String']);
    expectSchemaLine(pitchSessionModel, [
      'legacyBackfill',
      'Boolean',
      '@default(false)',
    ]);

    expectSql(`
      INSERT INTO "Chapter" (
        "id", "name", "slug", "city", "region", "country", "timezone",
        "description", "status", "accessMode"
      ) VALUES (
        'boston', 'Sundai Boston', 'boston', 'Boston', 'MA', 'US',
        'America/New_York', 'Initial Boston chapter backfilled for existing events.',
        'ACTIVE', 'PUBLIC'
      );
    `);
    expectSql(`
      ALTER TABLE "Event" RENAME TO "PitchSession";
    `);
    expectSql(`
      UPDATE "PitchSession"
      SET "chapterId" = 'boston',
          "legacyBackfill" = true;
    `);
    expectSql(`
      ALTER TABLE "PitchSession"
        ALTER COLUMN "chapterId" SET NOT NULL,
        ADD CONSTRAINT "PitchSession_event_or_legacy_check"
          CHECK ("eventId" IS NOT NULL OR "legacyBackfill" = true);
    `);
  });

  it('requires chapter-scoped unique event slugs on the new native event table', () => {
    const eventModel = readBlock(schema, 'model', 'Event');

    expectSchemaLine(eventModel, ['slug', 'String']);
    expect(eventModel).toContain('@@unique([chapterId, slug])');
    expect(eventModel).toContain('@@index([chapterId, status, startTime])');
    expect(eventModel).toContain('@@index([visibility, status])');

    expectSql(`
      CREATE TABLE "Event" (
    `);
    expectSql(`
      CREATE UNIQUE INDEX "Event_chapterId_slug_key" ON "Event"("chapterId", "slug");
    `);
  });

  it('creates EventStaff for native events without migrating legacy pitch MC assignments', () => {
    const eventStaffModel = readBlock(schema, 'model', 'EventStaff');
    const eventStaffRoleEnum = readBlock(schema, 'enum', 'EventStaffRole');

    expect(schema).not.toMatch(/\bmodel\s+EventMC\s*{/);
    expect(eventStaffRoleEnum).toMatch(/^\s*MC\s*$/m);
    expect(eventStaffRoleEnum).toMatch(/^\s*CO_MC\s*$/m);
    expectSchemaLine(eventStaffModel, ['eventId', 'String']);
    expectSchemaLine(eventStaffModel, ['hackerId', 'String']);
    expectSchemaLine(eventStaffModel, ['role', 'EventStaffRole']);
    expect(eventStaffModel).toContain('@@unique([eventId, hackerId])');
    expect(eventStaffModel).toContain('@@index([eventId, role])');
    expect(eventStaffModel).toContain('@@index([hackerId])');

    expectSql(`
      CREATE TYPE "EventStaffRole" AS ENUM ('MC', 'CO_MC');
    `);
    expectSql(`
      CREATE TABLE "EventStaff" (
        "id" TEXT NOT NULL,
        "eventId" TEXT NOT NULL,
        "hackerId" TEXT NOT NULL,
        "role" "EventStaffRole" NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "EventStaff_pkey" PRIMARY KEY ("id")
      );
    `);
    expect(migration).not.toContain('INSERT INTO "EventStaff"');
    expect(migration).not.toContain('FROM "EventMC"');
    expectSql(`
      DROP TABLE "EventMC";
    `);
  });

  it('creates the key event management tables and indexes declared by the Prisma schema', () => {
    [
      'Chapter',
      'ChapterMembership',
      'EventStaff',
      'ApplicationTemplate',
      'EventRegistration',
      'EventRegistrationAudit',
      'UserBan',
      'UserBanFlag',
      'HackerOrganizerNote',
      'HackerOrganizerNoteRevision',
    ].forEach(modelName => {
      expect(schema).toMatch(new RegExp(`\\bmodel\\s+${modelName}\\s*{`));
      expect(migration).toContain(`CREATE TABLE "${modelName}"`);
    });

    [
      'Chapter_slug_key',
      'ChapterMembership_chapterId_hackerId_key',
      'Event_chapterId_slug_key',
      'EventStaff_eventId_hackerId_role_key',
      'ApplicationTemplate_one_active_site',
      'ApplicationTemplate_one_active_chapter',
      'EventRegistration_eventId_hackerId_key',
      'UserBan_one_active_per_hacker',
      'HackerOrganizerNote_hackerId_key',
    ].forEach(indexName => {
      expect(migration).toContain(`"${indexName}"`);
    });
  });
});
