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

const readBlock = (source: string, kind: 'enum' | 'model', name: string) => {
  const match = source.match(new RegExp(`\\b${kind}\\s+${name}\\s*{([\\s\\S]*?)\\n}`));

  if (!match) {
    throw new Error(`Could not find ${kind} ${name}`);
  }

  return match[1];
};

const normalizeSql = (sql: string) => sql.replace(/\s+/g, ' ').trim();
const expectSql = (snippet: string) => {
  expect(normalizeSql(migration)).toContain(normalizeSql(snippet));
};

describe('event management foundation migration', () => {
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

  it('backfills the Boston chapter and attaches existing events to it', () => {
    const chapterModel = readBlock(schema, 'model', 'Chapter');
    const eventModel = readBlock(schema, 'model', 'Event');

    expect(chapterModel).toContain('slug                  String                @unique');
    expect(chapterModel).toContain('timezone              String');
    expect(eventModel).toContain('chapter          Chapter    @relation(fields: [chapterId], references: [id])');
    expect(eventModel).toContain('chapterId        String');

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
      UPDATE "Event"
      SET
        "chapterId" = 'boston',
        "status" = 'PUBLISHED',
        "publicLocation" = "location",
        "virtualUrl" = "meetingUrl";
    `);
    expectSql(`
      ALTER TABLE "Event"
        ALTER COLUMN "chapterId" SET NOT NULL,
        ALTER COLUMN "slug" SET NOT NULL;
    `);
  });

  it('requires chapter-scoped unique event slugs and migration cleanup markers', () => {
    const eventModel = readBlock(schema, 'model', 'Event');

    expect(eventModel).toContain('slug             String');
    expect(eventModel).toContain('slugNeedsCleanup Boolean    @default(false)');
    expect(eventModel).toContain('@@unique([chapterId, slug])');
    expect(eventModel).toContain('@@index([chapterId, status, startTime])');
    expect(eventModel).toContain('@@index([visibility, status])');

    expect(migration).toContain('WITH slug_base AS');
    expect(migration).toContain('regexp_replace(coalesce(nullif("title", \'\'), "id"), \'[^a-zA-Z0-9]+\', \'-\', \'g\')');
    expect(migration).toContain('row_number() OVER (PARTITION BY coalesce("baseSlug", \'event\') ORDER BY "id") AS "slugNumber"');
    expectSql(`
      "slugNeedsCleanup" = n."slugCount" > 1
    `);
    expectSql(`
      CREATE UNIQUE INDEX "Event_chapterId_slug_key" ON "Event"("chapterId", "slug");
    `);
  });

  it('migrates EventMC rows into EventStaff as MC assignments before dropping EventMC', () => {
    const eventStaffModel = readBlock(schema, 'model', 'EventStaff');
    const eventStaffRoleEnum = readBlock(schema, 'enum', 'EventStaffRole');

    expect(schema).not.toMatch(/\bmodel\s+EventMC\s*{/);
    expect(eventStaffRoleEnum).toMatch(/^\s*MC\s*$/m);
    expect(eventStaffRoleEnum).toMatch(/^\s*CO_MC\s*$/m);
    expect(eventStaffModel).toContain('eventId   String');
    expect(eventStaffModel).toContain('hackerId  String');
    expect(eventStaffModel).toContain('role      EventStaffRole');
    expect(eventStaffModel).toContain('@@unique([eventId, hackerId, role])');
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
    expectSql(`
      INSERT INTO "EventStaff" ("id", "eventId", "hackerId", "role", "createdAt", "updatedAt")
      SELECT "id", "eventId", "hackerId", 'MC'::"EventStaffRole", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      FROM "EventMC";
    `);
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
    ].forEach((modelName) => {
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
    ].forEach((indexName) => {
      expect(migration).toContain(`"${indexName}"`);
    });
  });
});
