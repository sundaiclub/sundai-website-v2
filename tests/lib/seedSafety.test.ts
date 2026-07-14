import fs from 'fs';
import path from 'path';

const rootDir = path.resolve(__dirname, '../..');
const seedPath = path.join(rootDir, 'prisma/seed.ts');
const seed = fs.readFileSync(seedPath, 'utf8');

describe('Prisma seed safety', () => {
  it('guards destructive cleanup from accidental production execution', () => {
    expect(seed).toContain('process.env.NODE_ENV === "production"');
    expect(seed).toContain('process.env.ALLOW_PRODUCTION_SEED_RESET');
    expect(seed).toContain('Refusing to run destructive seed cleanup');
    expect(seed.indexOf('Refusing to run destructive seed cleanup')).toBeLessThan(
      seed.indexOf('await prisma.eventRegistrationAudit.deleteMany')
    );
  });
});
