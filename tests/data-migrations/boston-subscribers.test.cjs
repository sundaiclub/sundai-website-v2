const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  planImport,
  readSubscribers,
  applyPlan,
} = require('../../scripts/import-boston-subscribers.cjs');

const contact = (email = 'member@example.com', extra = {}) => ({
  EMAIL: email,
  'CONTACT ID': '1',
  FIRSTNAME: 'Test',
  LASTNAME: 'Member',
  _BLOCKLISTED: '',
  _SUBSCRIBED: "['email_marketing'|'sms_marketing']",
  sourceRow: 2,
  ...extra,
});
const account = (extra = {}) => ({
  id: 'user_one',
  emails: ['member@example.com'],
  banned: false,
  locked: false,
  ...extra,
});
const profile = (extra = {}) => ({
  id: 'hacker_one',
  clerkId: 'user_one',
  email: 'member@example.com',
  userBans: [],
  chapterMemberships: [],
  ...extra,
});
const membership = (extra = {}) => ({
  id: 'membership_one',
  status: 'ACTIVE',
  notificationsAllowed: true,
  emailNotificationsEnabled: true,
  ...extra,
});
const plan = (rows = [contact()], users = [], hackers = []) =>
  planImport(rows, users, { chapter: { id: 'boston' }, hackers }, 'source-sha');

test('creates an unlinked profile and membership with stable IDs and plan hash', () => {
  const result = plan();
  assert.equal(result.summary.newProfilesWithoutClerk, 1);
  assert.equal(result.actions[0].profile.clerkId, null);
  assert.equal(result.actions[0].profile.name, 'Test Member');
  assert.equal(result.planHash, plan().planHash);
});

test('reuses a Clerk secondary email without changing the platform email or Clerk ID', () => {
  const result = plan(
    [contact('secondary@example.com')],
    [account({ emails: ['member@example.com', 'secondary@example.com'] })],
    [profile()]
  );
  assert.equal(result.actions.length, 1);
  assert.equal(result.actions[0].hackerId, 'hacker_one');
  assert.equal(result.actions[0].profile, null);
});

test('excludes a block on any channel, including a second CSV row or Clerk alias', () => {
  assert.equal(
    plan([contact(undefined, { _BLOCKLISTED: "['sms_marketing']" })]).actions
      .length,
    0
  );
  assert.equal(
    plan([
      contact(),
      contact(' MEMBER@example.com ', { _BLOCKLISTED: "['email_marketing']" }),
    ]).actions.length,
    0
  );
  const result = plan(
    [
      contact(),
      contact('other@example.com', { _BLOCKLISTED: "['sms_marketing']" }),
    ],
    [account({ emails: ['member@example.com', 'other@example.com'] })],
    [profile()]
  );
  assert.equal(result.actions.length, 0);
});

for (const [name, hacker, users, reason] of [
  [
    'email disabled',
    profile({
      chapterMemberships: [membership({ emailNotificationsEnabled: false })],
    }),
    [account()],
    'email_disabled',
  ],
  [
    'all notifications disabled',
    profile({
      chapterMemberships: [membership({ notificationsAllowed: false })],
    }),
    [account()],
    'email_disabled',
  ],
  [
    'left chapter',
    profile({ chapterMemberships: [membership({ status: 'LEFT' })] }),
    [account()],
    'inactive_membership',
  ],
  [
    'revoked membership',
    profile({ chapterMemberships: [membership({ status: 'REVOKED' })] }),
    [account()],
    'inactive_membership',
  ],
  ['missing Clerk account', profile(), [], 'missing_clerk_account'],
  [
    'changed Clerk email',
    profile(),
    [account({ emails: ['new@example.com'] })],
    'clerk_email_mismatch',
  ],
  [
    'platform ban',
    profile({ userBans: [{ id: 'ban' }] }),
    [account()],
    'platform_ban',
  ],
])
  test(`skips ${name}`, () => {
    const result = plan([contact()], users, [hacker]);
    assert.equal(result.actions.length, 0);
    assert.equal(result.decisions[0].outcome, reason);
  });

test('skips duplicate profiles and conflicting Clerk identities', () => {
  assert.equal(
    plan(
      [contact()],
      [account()],
      [profile(), profile({ id: 'duplicate', clerkId: 'user_two' })]
    ).decisions[0].outcome,
    'duplicate_platform_profiles'
  );
  assert.equal(
    plan(
      [contact()],
      [account()],
      [
        profile({ email: 'primary@example.com' }),
        profile({ id: 'other', clerkId: null }),
      ]
    ).decisions[0].outcome,
    'identity_conflict'
  );
});

test('does not change active memberships or create two memberships for aliases', () => {
  const rows = [contact(), contact('secondary@example.com')];
  const users = [
    account({ emails: ['member@example.com', 'secondary@example.com'] }),
  ];
  assert.equal(plan(rows, users, [profile()]).actions.length, 1);
  assert.equal(
    plan(rows, users, [profile({ chapterMemberships: [membership()] })]).actions
      .length,
    0
  );
});

test('a rerun does not recreate imported profiles or memberships', () => {
  const first = plan();
  const imported = profile({
    ...first.actions[0].profile,
    chapterMemberships: [membership()],
  });
  assert.equal(plan([contact()], [], [imported]).actions.length, 0);
});

test('writes email-only memberships and provenance without updating existing records', async () => {
  const writes = {};
  const tx = {
    hacker: {
      createMany: async args => {
        writes.profiles = args.data;
      },
    },
    chapterMembership: {
      createMany: async args => {
        writes.memberships = args.data;
      },
      count: async () => 1,
    },
  };
  const result = await applyPlan(tx, plan());
  assert.equal(result.profilesCreated, 1);
  assert.equal(writes.profiles[0].clerkId, null);
  assert.equal(writes.memberships[0].status, 'ACTIVE');
  assert.equal(writes.memberships[0].role, 'MEMBER');
  assert.equal(writes.memberships[0].emailNotificationsEnabled, true);
  assert.equal(writes.memberships[0].smsNotificationsEnabled, false);
  assert.equal(
    writes.memberships[0].notificationPreferencesJson.subscriberImport
      .sourceSha256,
    'source-sha'
  );
});

test('reads semicolon CSV with quoted delimiters and newlines as literal data', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sundai-csv-test-'));
  try {
    const file = path.join(dir, 'test.csv');
    fs.writeFileSync(
      file,
      'CONTACT ID;EMAIL;_SUBSCRIBED;_BLOCKLISTED;FIRSTNAME;LASTNAME\r\n1;member@example.com;"[\'email_marketing\']";;"Test; Name";"Last\nName"\r\n'
    );
    const rows = await readSubscribers(file);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].FIRSTNAME, 'Test; Name');
    assert.equal(rows[0].LASTNAME, 'Last\nName');
    assert.equal(plan(rows).actions.length, 1);
  } finally {
    fs.rmSync(dir, { recursive: true });
  }
});
