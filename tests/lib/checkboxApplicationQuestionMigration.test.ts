import fs from 'fs';
import path from 'path';

const migration = fs.readFileSync(
  path.resolve(
    __dirname,
    '../../prisma/migrations/20260713010000_checkbox_application_question_type/migration.sql'
  ),
  'utf8'
);

describe('checkbox application-question type cutover', () => {
  it('rewrites stored template and event fields to CHECKBOX', () => {
    expect(migration).toContain('UPDATE "ApplicationTemplate"');
    expect(migration).toContain('UPDATE "Event"');
    expect(migration).toContain('UPDATE "EventRegistration"');
    expect(migration.match(/field->>'type' = 'BOOLEAN'/g)).toHaveLength(3);
    expect(migration.match(/'"CHECKBOX"'::jsonb/g)).toHaveLength(3);
    expect(migration.match(/WITH ORDINALITY/g)).toHaveLength(3);
    expect(migration.match(/ORDER BY position/g)).toHaveLength(3);
  });
});
