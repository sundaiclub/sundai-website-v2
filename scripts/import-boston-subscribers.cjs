// Manual data migration. Clerk access is read-only. Dry run is the default.
const fs = require('node:fs');
const crypto = require('node:crypto');
const { parseArgs } = require('node:util');
const { v5: uuid } = require('uuid');

const normalize = value => (value || '').trim().toLowerCase();
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const groupBy = (items, key) => {
  const groups = new Map();
  for (const item of items) {
    const k = key(item);
    groups.set(k, [...(groups.get(k) || []), item]);
  }
  return groups;
};

async function readSubscribers(file) {
  const ExcelJS = require('exceljs');
  const workbook = new ExcelJS.Workbook();
  const sheet = await workbook.csv.readFile(file, {
    parserOptions: { delimiter: ';', ignoreEmpty: true },
    map: value => value,
  });
  const headers = sheet
    .getRow(1)
    .values.slice(1)
    .map(v => v.replace(/^\uFEFF/, ''));
  for (const field of [
    'CONTACT ID',
    'EMAIL',
    '_SUBSCRIBED',
    '_BLOCKLISTED',
    'FIRSTNAME',
    'LASTNAME',
  ]) {
    if (!headers.includes(field))
      throw new Error(`Missing CSV field: ${field}`);
  }
  if (new Set(headers).size !== headers.length)
    throw new Error('Duplicate CSV headers');
  const rows = [];
  sheet.eachRow((row, number) => {
    if (number === 1) return;
    if (row.values.length - 1 > headers.length)
      throw new Error(`Extra CSV columns at row ${number}`);
    rows.push({
      ...Object.fromEntries(
        headers.map((h, i) => [h, String(row.getCell(i + 1).value ?? '')])
      ),
      sourceRow: number,
    });
  });
  return rows;
}

async function readClerkUsers(secret) {
  if (!secret)
    throw new Error(
      'CLERK_SECRET_KEY is required for read-only identity checks'
    );
  const users = [];
  for (let offset = 0; ; offset += 500) {
    const response = await fetch(
      `https://api.clerk.com/v1/users?limit=500&offset=${offset}&order_by=%2Bcreated_at`,
      {
        headers: { Authorization: `Bearer ${secret}` },
        signal: AbortSignal.timeout(30000),
      }
    );
    if (!response.ok)
      throw new Error(`Clerk read failed: HTTP ${response.status}`);
    const page = await response.json();
    if (!Array.isArray(page)) throw new Error('Unexpected Clerk response');
    users.push(
      ...page.map(u => ({
        id: u.id,
        banned: u.banned,
        locked: u.locked,
        emails: u.email_addresses.map(e => normalize(e.email_address)),
      }))
    );
    if (page.length < 500) break;
  }
  if (new Set(users.map(u => u.id)).size !== users.length)
    throw new Error('Clerk pagination changed; rerun');
  return users;
}

async function readDatabase(tx) {
  const chapter = await tx.chapter.findUnique({ where: { slug: 'boston' } });
  if (
    !chapter ||
    chapter.status !== 'ACTIVE' ||
    chapter.accessMode !== 'PUBLIC'
  ) {
    throw new Error('Expected an active public Boston chapter');
  }
  const hackers = await tx.hacker.findMany({
    select: {
      id: true,
      clerkId: true,
      email: true,
      userBans: { where: { revokedAt: null }, select: { id: true } },
      chapterMemberships: {
        where: { chapterId: chapter.id },
        select: {
          id: true,
          status: true,
          notificationsAllowed: true,
          emailNotificationsEnabled: true,
        },
      },
    },
    orderBy: { id: 'asc' },
  });
  return { chapter, hackers };
}

function planImport(rows, users, { chapter, hackers }, sourceHash) {
  const csvByEmail = groupBy(rows, r => normalize(r.EMAIL));
  const hackersByEmail = groupBy(
    hackers.filter(h => normalize(h.email)),
    h => normalize(h.email)
  );
  const hackersByClerk = groupBy(
    hackers.filter(h => h.clerkId),
    h => h.clerkId
  );
  const clerksById = new Map(users.map(u => [u.id, u]));
  const clerksByEmail = new Map();
  for (const user of users)
    for (const email of user.emails) {
      clerksByEmail.set(email, [...(clerksByEmail.get(email) || []), user]);
    }
  const blockedEmails = new Set(
    [...csvByEmail]
      .filter(([, rs]) => rs.some(r => r._BLOCKLISTED.trim()))
      .map(([email]) => email)
  );
  const actions = [];
  const decisions = [];
  const seenHackers = new Set();
  for (const [email, contacts] of csvByEmail) {
    const row = contacts[0];
    const decision = {
      email,
      sourceRows: contacts.map(r => r.sourceRow),
      contactId: row['CONTACT ID'],
    };
    const skip = reason => decisions.push({ ...decision, outcome: reason });
    if (blockedEmails.has(email)) {
      skip('csv_blocklisted');
      continue;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      skip('invalid_email');
      continue;
    }
    if (!contacts.every(r => /['"]email_marketing['"]/.test(r._SUBSCRIBED))) {
      skip('not_email_subscribed');
      continue;
    }
    const matchingHackers = hackersByEmail.get(email) || [];
    if (matchingHackers.length > 1) {
      skip('duplicate_platform_profiles');
      continue;
    }
    const matchingClerks = clerksByEmail.get(email) || [];
    if (matchingClerks.length > 1) {
      skip('ambiguous_clerk_identity');
      continue;
    }
    const clerk = matchingClerks[0];
    if (clerk?.emails.some(e => blockedEmails.has(e))) {
      skip('blocklisted_account_alias');
      continue;
    }
    if (clerk?.banned || clerk?.locked) {
      skip('clerk_banned_or_locked');
      continue;
    }
    const linked = clerk ? hackersByClerk.get(clerk.id) || [] : [];
    if (linked.length > 1) {
      skip('ambiguous_clerk_identity');
      continue;
    }
    if (linked.length && matchingHackers.some(h => h.id !== linked[0].id)) {
      skip('identity_conflict');
      continue;
    }
    const hacker = linked[0] || matchingHackers[0];
    if (hacker && (hackersByEmail.get(normalize(hacker.email)) || []).length > 1) {
      skip('duplicate_platform_profiles');
      continue;
    }
    if (hacker?.clerkId) {
      const account = clerksById.get(hacker.clerkId);
      if (!account) {
        skip('missing_clerk_account');
        continue;
      }
      if (
        !account.emails.includes(normalize(hacker.email)) ||
        !account.emails.includes(email) ||
        (clerk && clerk.id !== account.id)
      ) {
        skip('clerk_email_mismatch');
        continue;
      }
    } else if (hacker && clerk) {
      // An existing unlinked profile is for later verified webhook linking.
      skip('unlinked_profile_with_existing_clerk');
      continue;
    }
    if (hacker?.userBans.length) {
      skip('platform_ban');
      continue;
    }
    const membership = hacker?.chapterMemberships[0];
    if (membership && membership.status !== 'ACTIVE') {
      skip('inactive_membership');
      continue;
    }
    if (
      membership &&
      (!membership.notificationsAllowed ||
        !membership.emailNotificationsEnabled)
    ) {
      skip('email_disabled');
      continue;
    }
    if (hacker && seenHackers.has(hacker.id)) {
      skip('duplicate_account_alias');
      continue;
    }
    if (hacker) seenHackers.add(hacker.id);
    if (membership) {
      skip('already_member');
      continue;
    }
    const hackerId = hacker?.id || uuid(`sundai:subscriber:${email}`, uuid.URL);
    const action = {
      ...decision,
      hackerId,
      chapterId: chapter.id,
      profile: hacker
        ? null
        : {
            id: hackerId,
            clerkId: clerk?.id || null,
            email,
            name:
              [row.FIRSTNAME.trim(), row.LASTNAME.trim()]
                .filter(Boolean)
                .join(' ') || email.split('@')[0],
            role: 'HACKER',
          },
    };
    actions.push(action);
    decisions.push({
      ...decision,
      hackerId,
      outcome: hacker ? 'add_membership' : 'create_profile_and_membership',
    });
  }
  const outcomes = {};
  for (const d of decisions)
    outcomes[d.outcome] = (outcomes[d.outcome] || 0) + 1;
  const summary = {
    sourceRows: rows.length,
    uniqueEmails: csvByEmail.size,
    outcomes,
    profilesToCreate: actions.filter(a => a.profile).length,
    membershipsToCreate: actions.length,
    newProfilesWithoutClerk: actions.filter(
      a => a.profile && !a.profile.clerkId
    ).length,
  };
  const plan = {
    sourceHash,
    chapterId: chapter.id,
    summary,
    actions,
    decisions,
  };
  return { ...plan, planHash: sha256(JSON.stringify(plan)) };
}

async function applyPlan(tx, plan) {
  const now = new Date();
  const profiles = plan.actions.flatMap(a => (a.profile ? [a.profile] : []));
  if (profiles.length) await tx.hacker.createMany({ data: profiles });
  if (plan.actions.length)
    await tx.chapterMembership.createMany({
      data: plan.actions.map(a => ({
        chapterId: a.chapterId,
        hackerId: a.hackerId,
        role: 'MEMBER',
        status: 'ACTIVE',
        joinedAt: now,
        notificationsAllowed: true,
        emailNotificationsEnabled: true,
        smsNotificationsEnabled: false,
        notificationPreferencesJson: {
          subscriberImport: {
            sourceSha256: plan.sourceHash,
            contactId: a.contactId,
            importedAt: now.toISOString(),
            subscription: 'email_marketing',
          },
        },
      })),
    });
  const count = await tx.chapterMembership.count({
    where: {
      chapterId: plan.chapterId,
      hackerId: { in: plan.actions.map(a => a.hackerId) },
      status: 'ACTIVE',
      notificationsAllowed: true,
      emailNotificationsEnabled: true,
    },
  });
  if (count !== plan.actions.length)
    throw new Error('Import verification failed; transaction rolled back');
  return { profilesCreated: profiles.length, membershipsCreated: count };
}

async function main() {
  const { values } = parseArgs({
    options: {
      csv: { type: 'string' },
      report: { type: 'string' },
      apply: { type: 'boolean', default: false },
      'expected-plan': { type: 'string' },
    },
  });
  if (!values.csv || !values.report)
    throw new Error('--csv and --report are required');
  if (values.apply && !values['expected-plan'])
    throw new Error('--apply requires --expected-plan from a dry run');
  const sourceHash = sha256(fs.readFileSync(values.csv));
  const rows = await readSubscribers(values.csv);
  const users = await readClerkUsers(process.env.CLERK_SECRET_KEY);
  const { PrismaClient } = require('@prisma/client');
  const db = new PrismaClient();
  // Reserve the private report before any writes. Never overwrite a prior audit.
  const reportFd = fs.openSync(values.report, 'wx', 0o600);
  try {
    let plan;
    let result;
    await db.$transaction(
      async tx => {
        if (values.apply) {
          // Email is not unique. Block concurrent profile/membership writes until
          // the fresh plan and bulk insert finish; a queued webhook then links it.
          await tx.$executeRaw`SET LOCAL lock_timeout = '10s'`;
          await tx.$executeRaw`LOCK TABLE "Hacker", "ChapterMembership" IN SHARE ROW EXCLUSIVE MODE`;
          await tx.$executeRaw`LOCK TABLE "Chapter", "UserBan" IN SHARE MODE`;
        } else await tx.$executeRaw`SET TRANSACTION READ ONLY`;
        plan = planImport(rows, users, await readDatabase(tx), sourceHash);
        if (values.apply && plan.planHash !== values['expected-plan'])
          throw new Error('Plan changed; run a new dry run before applying');
        fs.writeFileSync(
          reportFd,
          JSON.stringify({ state: 'planned', ...plan }, null, 2)
        );
        fs.fsyncSync(reportFd);
        if (values.apply) result = await applyPlan(tx, plan);
      },
      { isolationLevel: 'Serializable', timeout: 60000, maxWait: 15000 }
    );
    fs.ftruncateSync(reportFd, 0);
    const report = JSON.stringify(
      { state: values.apply ? 'committed' : 'dry_run', ...plan, result },
      null,
      2
    );
    fs.writeSync(reportFd, report, 0, 'utf8');
    fs.fsyncSync(reportFd);
    console.log(
      JSON.stringify(
        {
          mode: values.apply ? 'apply' : 'dry_run',
          sourceHash,
          planHash: plan.planHash,
          ...plan.summary,
          result,
        },
        null,
        2
      )
    );
  } finally {
    fs.closeSync(reportFd);
    await db.$disconnect();
  }
}

module.exports = {
  readSubscribers,
  planImport,
  applyPlan,
  readClerkUsers,
  readDatabase,
};
if (require.main === module)
  main().catch(error => {
    // Do not print database URLs, credentials, or subscriber data on errors.
    console.error(
      'Subscriber import failed:',
      error.code || error.name,
      error.message.replace(/postgres(?:ql)?:\/\/\S+/g, '[database URL]')
    );
    process.exitCode = 1;
  });
