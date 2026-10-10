const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const { buildSeedUsers, resolveSeedPasswords, redact, SeedConfigError } = require('../scripts/seedCredentials');

// Throw-away secrets generated per run, so no password literal exists in the repo.
const secret = () => crypto.randomBytes(18).toString('base64');
const goodEnv = () => ({ SEED_ADMIN_PASSWORD: secret(), SEED_USER_PASSWORD: secret() });

test('seed credentials: builds users from the environment', () => {
  const env = { ...goodEnv(), SEED_ADMIN_EMAIL: 'Boss@Example.com', SEED_USER_EMAIL: 'guest@example.com' };
  const [admin, user] = buildSeedUsers(env);
  assert.equal(admin.role, 'admin');
  assert.equal(admin.email, 'boss@example.com');
  assert.equal(admin.password, env.SEED_ADMIN_PASSWORD);
  assert.equal(user.role, 'user');
  assert.equal(user.password, env.SEED_USER_PASSWORD);
});

test('seed credentials: resolveSeedPasswords returns values keyed by env var name', () => {
  const env = goodEnv();
  const result = resolveSeedPasswords(env);
  assert.deepStrictEqual(Object.keys(result), ['SEED_ADMIN_PASSWORD', 'SEED_USER_PASSWORD']);
  assert.equal(result.SEED_ADMIN_PASSWORD, env.SEED_ADMIN_PASSWORD);
  assert.equal(result.SEED_USER_PASSWORD, env.SEED_USER_PASSWORD);
});

test('seed credentials: emails fall back to the existing sample addresses', () => {
  const [admin, user] = buildSeedUsers(goodEnv());
  assert.equal(admin.email, 'admin@stayeasy.com');
  assert.equal(user.email, 'guest@stayeasy.com');
});

test('seed credentials: refuses missing or empty passwords, with no fallback', () => {
  for (const env of [{}, { SEED_ADMIN_PASSWORD: '', SEED_USER_PASSWORD: '' }, { SEED_ADMIN_PASSWORD: secret() }, { SEED_USER_PASSWORD: secret() }]) {
    assert.throws(() => buildSeedUsers(env), SeedConfigError);
  }
});

test('seed credentials: refuses weak, padded, over-long, identical or malformed values', () => {
  const ok = secret();
  const cases = [
    { SEED_ADMIN_PASSWORD: 'short', SEED_USER_PASSWORD: ok },
    { SEED_ADMIN_PASSWORD: ` ${secret()}`, SEED_USER_PASSWORD: ok },
    { SEED_ADMIN_PASSWORD: 'x'.repeat(73), SEED_USER_PASSWORD: ok },
    { SEED_ADMIN_PASSWORD: ok, SEED_USER_PASSWORD: ok },
    { ...goodEnv(), SEED_ADMIN_EMAIL: 'not-an-email' },
    { ...goodEnv(), SEED_ADMIN_EMAIL: 'same@example.com', SEED_USER_EMAIL: 'SAME@example.com' },
  ];
  for (const env of cases) assert.throws(() => buildSeedUsers(env), SeedConfigError);
});

test('seed credentials: error messages never contain a password value', () => {
  const bad = 'short1';
  const other = secret();
  try {
    buildSeedUsers({ SEED_ADMIN_PASSWORD: bad, SEED_USER_PASSWORD: other });
    assert.fail('should have thrown');
  } catch (error) {
    assert.ok(error instanceof SeedConfigError);
    assert.ok(!error.message.includes(bad));
    assert.ok(!error.message.includes(other));
    assert.match(error.message, /SEED_ADMIN_PASSWORD/);
  }
});

test('seed credentials: redact strips secrets from text', () => {
  const s = secret();
  assert.ok(!redact(`boom ${s} boom`, [s]).includes(s));
});

test('seed: no built-in passwords in seed sources', () => {
  for (const file of ['../scripts/seed.js', '../scripts/seedCredentials.js']) {
    const source = fs.readFileSync(path.join(__dirname, file), 'utf8');
    assert.ok(!/(?:Admin|Guest)@\d{5}/.test(source), `${file} contains a built-in password`);
    assert.ok(!/SEED_\w*PASSWORD\s*\|\|/.test(source), `${file} falls back to a default password`);
  }
});

test('seed: the script refuses to run without passwords and exits before any DB connection', () => {
  const env = { ...process.env, SEED_ADMIN_PASSWORD: '', SEED_USER_PASSWORD: '', MONGO_URI: 'mongodb://127.0.0.1:1/never' };
  const result = spawnSync(process.execPath, [path.join(__dirname, '../scripts/seed.js')], { env, encoding: 'utf8', cwd: path.join(__dirname, '..') });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Seeding refused/);
  assert.ok(!/MongoDB/.test(result.stdout + result.stderr), 'must not attempt a DB connection');
});
