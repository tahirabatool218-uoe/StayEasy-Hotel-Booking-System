// Unit tests for the Step 2 security helpers. No database or network needed.
const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'unit-test-secret-unit-test-secret-12345';

const {
  validateName,
  validateEmail,
  validateNewPassword,
  validateExistingPassword,
} = require('../src/utils/validators');
const { validateEnv, getBcryptRounds } = require('../src/config/env');
const {
  hasOperatorKeys,
  rejectOperatorKeys,
  ensureBodyObject,
  getCorsOptions,
  parseTrustProxy,
} = require('../src/middleware/security');
const { serverError } = require('../src/utils/httpErrors');
const generateToken = require('../src/utils/generateToken');

const fakeRes = () => {
  const res = { statusCode: null, body: null };
  res.status = (code) => ((res.statusCode = code), res);
  res.json = (body) => ((res.body = body), res);
  return res;
};

test('validateEmail: normalises valid addresses and rejects junk and non-strings', () => {
  assert.deepEqual(validateEmail('  Ali@Example.COM '), { value: 'ali@example.com' });
  for (const bad of ['', '   ', 'no-at-sign', 'a@b', 'a b@c.com', 'a@@c.com', 'a@c..com', 'a@.com', 'x'.repeat(250) + '@a.com']) {
    assert.ok(validateEmail(bad).error, `should reject ${JSON.stringify(bad)}`);
  }
  for (const bad of [null, undefined, 42, true, ['a@b.com'], { $ne: null }]) {
    assert.ok(validateEmail(bad).error, `should reject non-string ${JSON.stringify(bad)}`);
  }
});

test('validateName: trims, bounds length, requires a string', () => {
  assert.deepEqual(validateName('  Tahira  '), { value: 'Tahira' });
  assert.ok(validateName('   ').error);
  assert.ok(validateName('x'.repeat(101)).error);
  for (const bad of [123, null, ['a'], { a: 1 }]) assert.ok(validateName(bad).error);
});

test('validateNewPassword: 8 to 72 bytes, strings only', () => {
  assert.ok(validateNewPassword('1234567').error);
  assert.deepEqual(validateNewPassword('12345678'), { value: '12345678' });
  assert.deepEqual(validateNewPassword('x'.repeat(72)), { value: 'x'.repeat(72) });
  assert.ok(validateNewPassword('x'.repeat(73)).error);
  // 40 two-byte characters = 80 bytes: under 72 characters but over 72 bytes.
  assert.ok(validateNewPassword('é'.repeat(40)).error);
  for (const bad of [12345678, null, ['12345678'], { a: 1 }]) assert.ok(validateNewPassword(bad).error);
});

test('validateExistingPassword: no minimum (old 6-char accounts must still sign in), but typed and capped', () => {
  assert.deepEqual(validateExistingPassword('abc123'), { value: 'abc123' });
  assert.ok(validateExistingPassword('').error);
  assert.ok(validateExistingPassword('x'.repeat(129)).error);
  for (const bad of [1, null, { $ne: '' }, ['a']]) assert.ok(validateExistingPassword(bad).error);
});

test('validateEnv: requires MONGO_URI and JWT_SECRET', () => {
  const { errors } = validateEnv({});
  assert.equal(errors.length, 2);
  assert.ok(errors.some((e) => e.includes('MONGO_URI')));
  assert.ok(errors.some((e) => e.includes('JWT_SECRET')));
});

test('validateEnv: short secret is a warning in development, an error in production', () => {
  const base = { MONGO_URI: 'mongodb://x', JWT_SECRET: 'short', CORS_ORIGINS: 'https://a.example' };
  const dev = validateEnv(base);
  assert.equal(dev.errors.length, 0);
  assert.equal(dev.warnings.length, 1);
  const prod = validateEnv({ ...base, NODE_ENV: 'production' });
  assert.ok(prod.errors.some((e) => e.includes('JWT_SECRET')));
  const placeholder = validateEnv({ ...base, NODE_ENV: 'production', JWT_SECRET: 'changeme'.padEnd(40, 'x') });
  assert.equal(placeholder.errors.length, 0, 'a long value is accepted even if it starts with a common word');
  assert.ok(validateEnv({ ...base, NODE_ENV: 'production', JWT_SECRET: 'password' }).errors.length > 0);
});

test('validateEnv: production requires CORS_ORIGINS; numeric settings are checked', () => {
  const ok = { MONGO_URI: 'mongodb://x', JWT_SECRET: 'x'.repeat(40), NODE_ENV: 'production' };
  assert.ok(validateEnv(ok).errors.some((e) => e.includes('CORS_ORIGINS')));
  assert.equal(validateEnv({ ...ok, CORS_ORIGINS: 'https://a.example' }).errors.length, 0);
  assert.ok(validateEnv({ ...ok, CORS_ORIGINS: 'https://a.example', PORT: 'abc' }).errors.some((e) => e.includes('PORT')));
  assert.ok(validateEnv({ ...ok, CORS_ORIGINS: 'https://a.example', BCRYPT_ROUNDS: '4' }).errors.some((e) => e.includes('BCRYPT')));
  assert.ok(validateEnv({ ...ok, CORS_ORIGINS: 'https://a.example', AUTH_RATE_LIMIT_MAX: '0' }).errors.length > 0);
});

test('getBcryptRounds defaults to 12 and honours a valid override', () => {
  assert.equal(getBcryptRounds({}), 12);
  assert.equal(getBcryptRounds({ BCRYPT_ROUNDS: '10' }), 10);
  assert.equal(getBcryptRounds({ BCRYPT_ROUNDS: '3' }), 12);
});

test('hasOperatorKeys finds $-prefixed and dotted keys at any depth', () => {
  assert.equal(hasOperatorKeys({ email: { $ne: null } }), true);
  assert.equal(hasOperatorKeys({ a: [{ b: { $gt: 1 } }] }), true);
  assert.equal(hasOperatorKeys({ 'a.b': 1 }), true);
  assert.equal(hasOperatorKeys({ name: 'x', amenities: ['wifi'], nested: { ok: 1 } }), false);
  assert.equal(hasOperatorKeys('string'), false);
  assert.equal(hasOperatorKeys(null), false);
  let deep = {};
  for (let i = 0; i < 40; i += 1) deep = { a: deep };
  assert.equal(hasOperatorKeys(deep), true, 'absurdly deep input is refused');
});

test('rejectOperatorKeys answers 400 for operators in body, query or params, otherwise continues', () => {
  const run = (req) => {
    const res = fakeRes();
    let nexted = false;
    rejectOperatorKeys(req, res, () => { nexted = true; });
    return { res, nexted };
  };
  const bad = run({ body: { email: { $ne: null } }, query: {}, params: {} });
  assert.equal(bad.res.statusCode, 400);
  assert.equal(bad.nexted, false);
  assert.equal(run({ body: {}, query: { $where: '1' }, params: {} }).res.statusCode, 400);
  assert.equal(run({ body: { name: 'ok' }, query: { city: 'Lahore' }, params: { id: 'x' } }).nexted, true);
});

test('ensureBodyObject normalises a missing body and rejects arrays and scalars', () => {
  const run = (body) => {
    const req = { body };
    const res = fakeRes();
    let nexted = false;
    ensureBodyObject(req, res, () => { nexted = true; });
    return { req, res, nexted };
  };
  const missing = run(undefined);
  assert.equal(missing.nexted, true);
  assert.deepEqual(missing.req.body, {});
  assert.equal(run([1]).res.statusCode, 400);
  assert.equal(run('x').res.statusCode, 400);
  assert.equal(run({ a: 1 }).nexted, true);
});

test('getCorsOptions: null when unset, allowlist otherwise', () => {
  assert.equal(getCorsOptions({}), null);
  const options = getCorsOptions({ CORS_ORIGINS: 'https://a.example, https://b.example/ ' });
  const check = (origin) => {
    let allowed;
    options.origin(origin, (err, ok) => { allowed = ok; });
    return allowed;
  };
  assert.equal(check('https://a.example'), true);
  assert.equal(check('https://b.example'), true);
  assert.equal(check('https://evil.example'), false);
  assert.equal(check(undefined), true, 'non-browser callers have no Origin header');
});

test('parseTrustProxy', () => {
  assert.equal(parseTrustProxy(undefined), false);
  assert.equal(parseTrustProxy('1'), 1);
  assert.equal(parseTrustProxy('true'), true);
  assert.equal(parseTrustProxy('loopback'), 'loopback');
});

test('serverError never leaks the underlying error', () => {
  const original = console.error;
  console.error = () => {};
  try {
    const leaky = new Error('connect ECONNREFUSED mongodb://user:secret@db.internal:27017');
    const res = fakeRes();
    serverError(res, leaky);
    assert.equal(res.statusCode, 500);
    assert.deepEqual(res.body, { message: 'Server error' });
    assert.ok(!JSON.stringify(res.body).includes('secret'));

    const cast = fakeRes();
    serverError(cast, Object.assign(new Error('Cast to ObjectId failed for value "{...}"'), { name: 'CastError' }));
    assert.equal(cast.statusCode, 400);
    assert.ok(!cast.body.message.includes('ObjectId'));

    const dup = fakeRes();
    serverError(dup, Object.assign(new Error('E11000 duplicate key {email: "a@b.c"}'), { code: 11000 }));
    assert.equal(dup.statusCode, 409);
    assert.ok(!dup.body.message.includes('E11000'));
  } finally {
    console.error = original;
  }
});

test('verifyToken accepts our HS256 tokens and rejects other algorithms, keys, "none" and expired tokens', () => {
  const id = '507f1f77bcf86cd799439011';
  assert.equal(generateToken.verifyToken(generateToken(id)).id, id);

  const secret = process.env.JWT_SECRET;
  assert.throws(() => generateToken.verifyToken(jwt.sign({ id }, secret, { algorithm: 'HS512' })));
  assert.throws(() => generateToken.verifyToken(jwt.sign({ id }, 'another-secret-another-secret-1234')));
  assert.throws(() => generateToken.verifyToken(jwt.sign({ id }, secret, { expiresIn: -10 })));
  const none = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify({ id })).toString('base64url')}.`;
  assert.throws(() => generateToken.verifyToken(none));
  assert.throws(() => generateToken.verifyToken('not.a.token'));
});

test('isIssuedBeforePasswordChange compares at second granularity and ignores accounts that never changed it', () => {
  const changedAt = new Date('2026-10-10T10:00:30.500Z');
  const sec = Math.floor(changedAt.getTime() / 1000);
  assert.equal(generateToken.isIssuedBeforePasswordChange({ iat: sec - 1 }, { passwordChangedAt: changedAt }), true);
  assert.equal(generateToken.isIssuedBeforePasswordChange({ iat: sec }, { passwordChangedAt: changedAt }), false);
  assert.equal(generateToken.isIssuedBeforePasswordChange({ iat: sec + 5 }, { passwordChangedAt: changedAt }), false);
  assert.equal(generateToken.isIssuedBeforePasswordChange({ iat: 1 }, {}), false);
});

test('protect: 401 for credential problems, 503 (not 401) when the user lookup itself fails', async (t) => {
  const User = require('../src/models/User');
  const protect = require('../src/middleware/authMiddleware');
  const id = '507f1f77bcf86cd799439011';
  const call = async (headers) => {
    const req = { headers };
    const res = fakeRes();
    let nexted = false;
    await protect(req, res, () => { nexted = true; });
    return { req, res, nexted };
  };
  const origError = console.error;
  console.error = () => {};
  t.after(() => { console.error = origError; });

  assert.equal((await call({})).res.statusCode, 401);
  assert.equal((await call({ authorization: 'Basic abc' })).res.statusCode, 401);
  assert.equal((await call({ authorization: 'Bearer garbage' })).res.statusCode, 401);
  assert.equal((await call({ authorization: `Bearer ${jwt.sign({ id: { $ne: 1 } }, process.env.JWT_SECRET)}` })).res.statusCode, 401, 'non-string id in token');

  t.mock.method(User, 'findById', async () => { throw new Error('database unavailable'); });
  const outage = await call({ authorization: `Bearer ${generateToken(id)}` });
  assert.equal(outage.res.statusCode, 503, 'an outage must not look like an invalid session');
  assert.ok(!JSON.stringify(outage.res.body).includes('database unavailable'));

  t.mock.method(User, 'findById', async () => null);
  assert.equal((await call({ authorization: `Bearer ${generateToken(id)}` })).res.statusCode, 401);

  t.mock.method(User, 'findById', async () => ({ _id: id, role: 'user', passwordChangedAt: new Date(Date.now() + 60000) }));
  assert.equal((await call({ authorization: `Bearer ${generateToken(id)}` })).res.statusCode, 401, 'token older than a password change');

  t.mock.method(User, 'findById', async () => ({ _id: id, role: 'user' }));
  const ok = await call({ authorization: `bearer ${generateToken(id)}` });
  assert.equal(ok.nexted, true);
  assert.equal(ok.req.user.role, 'user');
});

test('seed: no built-in passwords; refuses to run without them', () => {
  const { SEED_USERS, resolveSeedPasswords } = require('../scripts/seed');
  for (const def of SEED_USERS) {
    assert.equal(def.password, undefined, 'seed data carries no credential');
  }
  assert.throws(() => resolveSeedPasswords({}), /SEED_ADMIN_PASSWORD is not set; SEED_USER_PASSWORD is not set/);
  assert.throws(() => resolveSeedPasswords({ SEED_ADMIN_PASSWORD: 'short', SEED_USER_PASSWORD: 'longenough1' }), /8-72/);
  const resolved = resolveSeedPasswords({ SEED_ADMIN_PASSWORD: 'adminpass-1', SEED_USER_PASSWORD: 'userpass-12' });
  assert.deepEqual(Object.keys(resolved).sort(), ['SEED_ADMIN_PASSWORD', 'SEED_USER_PASSWORD']);
});
