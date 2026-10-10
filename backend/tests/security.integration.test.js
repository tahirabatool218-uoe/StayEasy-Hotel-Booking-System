// HTTP integration tests for the Step 2 security hardening.
//
//   TEST_MONGO_URI=mongodb://127.0.0.1:27017 npm test
//
// Skipped without TEST_MONGO_URI. Each server is a real `node server.js`
// process against a uniquely named throwaway database that is dropped at the
// end. Never point TEST_MONGO_URI at a database you care about.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const path = require('node:path');

const TEST_MONGO_URI = process.env.TEST_MONGO_URI;
const skip = TEST_MONGO_URI ? false : 'TEST_MONGO_URI is not set';
const BACKEND = path.join(__dirname, '..');
const SECRET = 'security-test-secret-security-test-secret-1';

process.env.JWT_SECRET = SECRET;
process.env.BCRYPT_ROUNDS = '10';

describe('Step 2 security hardening (HTTP)', { skip }, () => {
  let mongoose, User, Hotel, generateToken, jwt;
  let uri, dbName;
  const servers = [];
  let main; // { base }
  let admin, adminToken;

  const startServer = async (extraEnv = {}) => {
    const port = 20000 + Math.floor(Math.random() * 20000);
    const base = `http://127.0.0.1:${port}`;
    const child = spawn(process.execPath, ['server.js'], {
      cwd: BACKEND,
      env: {
        ...process.env,
        PORT: String(port),
        MONGO_URI: uri,
        JWT_SECRET: SECRET,
        BOOKING_TIMEZONE: 'UTC',
        BCRYPT_ROUNDS: '10',
        API_RATE_LIMIT_MAX: '100000',
        AUTH_RATE_LIMIT_MAX: '100000',
        AUTH_REGISTER_LIMIT_MAX: '100000',
        ...extraEnv,
      },
      stdio: 'ignore',
    });
    servers.push(child);
    for (let i = 0; i < 60; i += 1) {
      try {
        if ((await fetch(`${base}/`)).ok) return { base, child };
      } catch (e) {
        /* not up yet */
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    throw new Error('test server did not start');
  };

  const call = async (base, method, url, { token, body, raw, headers } = {}) => {
    const res = await fetch(`${base}${url}`, {
      method,
      headers: {
        ...(raw === undefined && body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...headers,
      },
      body: raw !== undefined ? raw : body === undefined ? undefined : JSON.stringify(body),
    });
    let data = null;
    try {
      data = await res.json();
    } catch (e) {
      /* empty body */
    }
    return { status: res.status, data, headers: res.headers };
  };
  const api = (method, url, opts) => call(main.base, method, url, opts);
  const expectStatus = (res, status) =>
    assert.equal(res.status, status, `expected ${status}, got ${res.status}: ${JSON.stringify(res.data)}`);

  let seq = 0;
  const email = () => `sec${++seq}-${Date.now()}@test.dev`;

  before(async () => {
    mongoose = require('mongoose');
    User = require('../src/models/User');
    Hotel = require('../src/models/Hotel');
    generateToken = require('../src/utils/generateToken');
    jwt = require('jsonwebtoken');

    dbName = `stayeasy_sec_${process.pid}_${Date.now()}`;
    uri = `${TEST_MONGO_URI.replace(/\/$/, '')}/${dbName}`;
    await mongoose.connect(uri);

    admin = await User.create({ name: 'Admin', email: 'admin@sec.dev', password: 'adminpass1', role: 'admin' });
    adminToken = generateToken(admin._id);
    main = await startServer();
  });

  after(async () => {
    servers.forEach((s) => s.kill());
    if (mongoose) {
      await mongoose.connection.dropDatabase().catch(() => {});
      await mongoose.disconnect();
    }
  });

  describe('registration', () => {
    it('creates a user, normalises the email, never returns a password, and ignores a client-sent role', async () => {
      const addr = email().toUpperCase();
      const res = await api('POST', '/api/auth/register', {
        body: { name: '  New User ', email: `  ${addr} `, password: 'goodpass1', role: 'admin' },
      });
      expectStatus(res, 201);
      assert.equal(res.data.email, addr.toLowerCase());
      assert.equal(res.data.name, 'New User');
      assert.equal(res.data.role, 'user');
      assert.ok(res.data.token);
      assert.equal(res.data.password, undefined);
      const stored = await User.findOne({ email: addr.toLowerCase() }).select('+password');
      assert.notEqual(stored.password, 'goodpass1');
      assert.match(stored.password, /^\$2[aby]\$10\$/, 'bcrypt hash at the configured cost');
    });

    it('returns 409 for a duplicate email, whatever its letter case', async () => {
      const addr = email();
      expectStatus(await api('POST', '/api/auth/register', { body: { name: 'A', email: addr, password: 'goodpass1' } }), 201);
      expectStatus(await api('POST', '/api/auth/register', { body: { name: 'B', email: addr.toUpperCase(), password: 'goodpass1' } }), 409);
    });

    it('returns 400 (never 500) for wrong types, bad emails, weak passwords and missing fields', async () => {
      const bads = [
        {},
        { name: 'A', email: email() },
        { name: 'A', email: { $ne: null }, password: 'goodpass1' },
        { name: 12345, email: email(), password: 'goodpass1' },
        { name: 'A', email: email(), password: ['goodpass1'] },
        { name: 'A', email: email(), password: 12345678 },
        { name: 'A', email: 'not-an-email', password: 'goodpass1' },
        { name: 'A', email: email(), password: 'short' },
        { name: 'A', email: email(), password: 'x'.repeat(73) },
        { name: '   ', email: email(), password: 'goodpass1' },
        { name: 'x'.repeat(101), email: email(), password: 'goodpass1' },
      ];
      for (const body of bads) {
        const res = await api('POST', '/api/auth/register', { body });
        assert.equal(res.status, 400, `${JSON.stringify(body)} -> ${res.status} ${JSON.stringify(res.data)}`);
        assert.equal(res.data.error, undefined, 'no raw error field');
      }
    });
  });

  describe('login', () => {
    let addr;
    before(async () => {
      addr = email();
      expectStatus(await api('POST', '/api/auth/register', { body: { name: 'Login User', email: addr, password: 'goodpass1' } }), 201);
    });

    it('signs in with the right password (email is case-insensitive)', async () => {
      const res = await api('POST', '/api/auth/login', { body: { email: addr.toUpperCase(), password: 'goodpass1' } });
      expectStatus(res, 200);
      assert.ok(res.data.token);
      assert.equal(res.data.password, undefined);
    });

    it('gives the same 401 for a wrong password and an unknown account', async () => {
      const wrong = await api('POST', '/api/auth/login', { body: { email: addr, password: 'wrongpass1' } });
      const unknown = await api('POST', '/api/auth/login', { body: { email: email(), password: 'wrongpass1' } });
      expectStatus(wrong, 401);
      expectStatus(unknown, 401);
      assert.deepEqual(wrong.data, unknown.data);
    });

    it('rejects NoSQL operator payloads and wrong types with 400, never logging anyone in', async () => {
      const bads = [
        { email: { $ne: null }, password: { $ne: null } },
        { email: addr, password: { $ne: '' } },
        { email: { $gt: '' }, password: 'goodpass1' },
        { email: addr, password: 12345 },
        { email: [addr], password: 'goodpass1' },
        { email: addr },
      ];
      for (const body of bads) {
        const res = await api('POST', '/api/auth/login', { body });
        assert.equal(res.status, 400, `${JSON.stringify(body)} -> ${res.status}`);
        assert.equal(res.data.token, undefined);
      }
    });

    it('still lets an account with an old 6-character password sign in', async () => {
      const legacy = email();
      await User.create({ name: 'Legacy', email: legacy, password: 'abc123' });
      expectStatus(await api('POST', '/api/auth/login', { body: { email: legacy, password: 'abc123' } }), 200);
    });
  });

  describe('injection into other endpoints', () => {
    it('rejects operator keys in an admin hotel payload and in query/body generally', async () => {
      const res = await api('POST', '/api/hotels', {
        token: adminToken,
        body: { name: { $gt: '' }, description: 'd', location: 'l', city: 'c', country: 'k', address: 'a', pricePerNight: 1 },
      });
      expectStatus(res, 400);
      assert.equal(await Hotel.countDocuments(), 0, 'nothing was created');
      expectStatus(await api('GET', '/api/hotels?city[$ne]=x'), 200);
    });
  });

  describe('request hardening', () => {
    it('answers 413 for an oversized body, 400 for malformed JSON, arrays and a missing body', async () => {
      const big = await api('POST', '/api/auth/register', { body: { name: 'x'.repeat(200 * 1024), email: email(), password: 'goodpass1' } });
      expectStatus(big, 413);
      expectStatus(await api('POST', '/api/auth/login', { raw: '{"email": ' }), 400);
      expectStatus(await api('POST', '/api/auth/login', { raw: '[1,2]' }), 400);
      expectStatus(await api('POST', '/api/auth/login'), 400);
      expectStatus(await api('POST', '/api/hotels', { token: adminToken }), 400);
    });

    it('sets security headers and hides x-powered-by', async () => {
      const res = await api('GET', '/');
      assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
      assert.ok(res.headers.get('strict-transport-security'));
      assert.equal(res.headers.get('x-powered-by'), null);
    });

    it('error bodies never carry an `error`/stack field', async () => {
      const res = await api('GET', '/api/nope');
      expectStatus(res, 404);
      assert.equal(res.data.error, undefined);
      assert.equal(res.data.stack, undefined);
      const badId = await api('GET', '/api/hotels/not-an-id');
      expectStatus(badId, 400);
    });
  });

  describe('CORS allowlist', () => {
    it('only echoes allowed origins when CORS_ORIGINS is set', async () => {
      const s = await startServer({ CORS_ORIGINS: 'https://app.example.com' });
      const allowed = await call(s.base, 'GET', '/', { headers: { Origin: 'https://app.example.com' } });
      const denied = await call(s.base, 'GET', '/', { headers: { Origin: 'https://evil.example.com' } });
      assert.equal(allowed.headers.get('access-control-allow-origin'), 'https://app.example.com');
      assert.equal(denied.headers.get('access-control-allow-origin'), null);
      expectStatus(denied, 200); // server-side calls without CORS enforcement still work
    });
  });

  describe('rate limiting', () => {
    it('answers 429 after repeated failed logins, as JSON', async () => {
      const s = await startServer({ AUTH_RATE_LIMIT_MAX: '3' });
      const body = { email: email(), password: 'wrongpass1' };
      for (let i = 0; i < 3; i += 1) {
        expectStatus(await call(s.base, 'POST', '/api/auth/login', { body }), 401);
      }
      const limited = await call(s.base, 'POST', '/api/auth/login', { body });
      expectStatus(limited, 429);
      assert.match(limited.data.message, /Too many/);
    });

    it('does not count successful logins against the limit', async () => {
      const s = await startServer({ AUTH_RATE_LIMIT_MAX: '2' });
      const addr = email();
      expectStatus(await call(s.base, 'POST', '/api/auth/register', { body: { name: 'R', email: addr, password: 'goodpass1' } }), 201);
      for (let i = 0; i < 5; i += 1) {
        expectStatus(await call(s.base, 'POST', '/api/auth/login', { body: { email: addr, password: 'goodpass1' } }), 200);
      }
    });

    it('limits sign-ups per address', async () => {
      const s = await startServer({ AUTH_REGISTER_LIMIT_MAX: '2' });
      for (let i = 0; i < 2; i += 1) {
        expectStatus(await call(s.base, 'POST', '/api/auth/register', { body: { name: 'R', email: email(), password: 'goodpass1' } }), 201);
      }
      expectStatus(await call(s.base, 'POST', '/api/auth/register', { body: { name: 'R', email: email(), password: 'goodpass1' } }), 429);
    });
  });

  describe('tokens and sessions', () => {
    let addr, token, userId;
    before(async () => {
      addr = email();
      const res = await api('POST', '/api/auth/register', { body: { name: 'Session User', email: addr, password: 'goodpass1' } });
      token = res.data.token;
      userId = res.data._id;
    });

    it('/auth/me works with a valid token and never exposes the password hash', async () => {
      const res = await api('GET', '/api/auth/me', { token });
      expectStatus(res, 200);
      assert.equal(res.data.email, addr);
      assert.equal(res.data.password, undefined);
      assert.equal(res.data.passwordChangedAt, undefined);
    });

    it('rejects tampered, wrong-algorithm, "none", expired and malformed tokens with 401', async () => {
      const bads = [
        `${token}x`,
        jwt.sign({ id: userId }, SECRET, { algorithm: 'HS512' }),
        jwt.sign({ id: userId }, 'a-different-secret-a-different-secret-1'),
        jwt.sign({ id: userId }, SECRET, { expiresIn: -5 }),
        jwt.sign({ id: { $ne: null } }, SECRET),
        `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify({ id: userId })).toString('base64url')}.`,
        'garbage',
      ];
      for (const bad of bads) {
        expectStatus(await api('GET', '/api/auth/me', { token: bad }), 401);
      }
    });

    it('rejects the token of a user who no longer exists', async () => {
      const ghost = await User.create({ name: 'Ghost', email: email(), password: 'ghostpass1' });
      const ghostToken = generateToken(ghost._id);
      expectStatus(await api('GET', '/api/auth/me', { token: ghostToken }), 200);
      await User.deleteOne({ _id: ghost._id });
      expectStatus(await api('GET', '/api/auth/me', { token: ghostToken }), 401);
    });

    it('a role change takes effect immediately (role is read from the database, not the token)', async () => {
      const u = await User.create({ name: 'Promote', email: email(), password: 'promopass1' });
      const t = generateToken(u._id);
      expectStatus(await api('GET', '/api/admin/users', { token: t }), 403);
      await User.updateOne({ _id: u._id }, { role: 'admin' });
      expectStatus(await api('GET', '/api/admin/users', { token: t }), 200);
    });

    it('change-password: validates input, then invalidates old tokens and returns a working new one', async () => {
      const u = await User.create({ name: 'Changer', email: email(), password: 'oldpass-1' });
      const oldToken = generateToken(u._id);
      // Tokens carry second-level timestamps; make the old one strictly older than the change.
      await new Promise((r) => setTimeout(r, 1100));

      expectStatus(await api('PUT', '/api/users/change-password', { token: oldToken, body: { currentPassword: 'oldpass-1' } }), 400);
      expectStatus(await api('PUT', '/api/users/change-password', { token: oldToken, body: { currentPassword: { $ne: '' }, newPassword: 'newpass-12' } }), 400);
      expectStatus(await api('PUT', '/api/users/change-password', { token: oldToken, body: { currentPassword: 'oldpass-1', newPassword: ['newpass-12'] } }), 400);
      const weak = await api('PUT', '/api/users/change-password', { token: oldToken, body: { currentPassword: 'oldpass-1', newPassword: 'short' } });
      expectStatus(weak, 400);
      assert.match(weak.data.message, /New password/);
      expectStatus(await api('PUT', '/api/users/change-password', { token: oldToken, body: { currentPassword: 'wrong-pass', newPassword: 'newpass-12' } }), 400);
      expectStatus(await api('GET', '/api/auth/me', { token: oldToken }), 200); // nothing changed yet

      const changed = await api('PUT', '/api/users/change-password', { token: oldToken, body: { currentPassword: 'oldpass-1', newPassword: 'newpass-12' } });
      expectStatus(changed, 200);
      assert.equal(changed.data.message, 'Password updated successfully');
      assert.ok(changed.data.token);

      expectStatus(await api('GET', '/api/auth/me', { token: oldToken }), 401);
      expectStatus(await api('GET', '/api/auth/me', { token: changed.data.token }), 200);
      expectStatus(await api('POST', '/api/auth/login', { body: { email: u.email, password: 'oldpass-1' } }), 401);
      expectStatus(await api('POST', '/api/auth/login', { body: { email: u.email, password: 'newpass-12' } }), 200);
    });

    it('profile updates reject wrong types and bad emails with 400, and duplicate emails with 409', async () => {
      const other = email();
      await User.create({ name: 'Other', email: other, password: 'otherpass1' });
      for (const body of [{ name: 123 }, { name: {} }, { name: '   ' }, { email: 5 }, { email: 'nope' }, { email: { $ne: 1 } }]) {
        const res = await api('PUT', '/api/users/profile', { token, body });
        assert.equal(res.status, 400, `${JSON.stringify(body)} -> ${res.status}`);
      }
      expectStatus(await api('PUT', '/api/users/profile', { token, body: { email: other.toUpperCase() } }), 409);
      const ok = await api('PUT', '/api/users/profile', { token, body: { name: '  Renamed  ', role: 'admin' } });
      expectStatus(ok, 200);
      assert.equal(ok.data.name, 'Renamed');
      assert.equal(ok.data.role, 'user');
    });
  });

  describe('review input types (Step 1 behaviour preserved)', () => {
    it('rejects non-numeric ratings and non-string comments with 400', async () => {
      const t = (await api('POST', '/api/auth/register', { body: { name: 'Rev', email: email(), password: 'goodpass1' } })).data.token;
      const base = { hotel: '507f1f77bcf86cd799439011', booking: '507f1f77bcf86cd799439012' };
      for (const body of [
        { ...base, rating: '5', comment: 'ok' },
        { ...base, rating: { $gt: 0 }, comment: 'ok' },
        { ...base, rating: 5, comment: { a: 1 } },
        { hotel: { a: 1 }, booking: base.booking, rating: 5, comment: 'ok' },
      ]) {
        const res = await api('POST', '/api/reviews', { token: t, body });
        assert.equal(res.status, 400, `${JSON.stringify(body)} -> ${res.status}`);
      }
    });
  });

  describe('startup configuration', () => {
    const boot = (env) =>
      spawnSync(process.execPath, ['server.js'], {
        cwd: BACKEND,
        env: { PATH: process.env.PATH, ...env },
        encoding: 'utf8',
        timeout: 15000,
      });

    it('exits with a clear message when JWT_SECRET is missing', () => {
      const r = boot({ MONGO_URI: uri });
      assert.equal(r.status, 1);
      assert.match(r.stderr, /JWT_SECRET is required/);
    });

    it('exits when production is misconfigured (weak secret, no CORS_ORIGINS)', () => {
      const r = boot({ MONGO_URI: uri, JWT_SECRET: 'short', NODE_ENV: 'production' });
      assert.equal(r.status, 1);
      assert.match(r.stderr, /JWT_SECRET must be at least 32/);
      assert.match(r.stderr, /CORS_ORIGINS is required/);
    });

    it('the seed script refuses to run without passwords and never touches the database', () => {
      const r = spawnSync(process.execPath, ['scripts/seed.js'], {
        cwd: BACKEND,
        env: { PATH: process.env.PATH, MONGO_URI: uri },
        encoding: 'utf8',
        timeout: 15000,
      });
      assert.equal(r.status, 1);
      assert.match(r.stderr + r.stdout, /SEED_ADMIN_PASSWORD is not set/);
    });
  });
});
