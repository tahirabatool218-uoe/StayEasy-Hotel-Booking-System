// Unit tests for the profile-image feature. No database or network needed:
// User.findById is replaced with an in-memory stub where a controller is run.
const test = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET = 'unit-test-secret-unit-test-secret-12345';

const { validateProfileImage, buildAvatarUploadParams } = require('../src/utils/profileImage');
const { signUploadParams } = require('../src/utils/cloudinarySignature');

const ID = '64b7f0c2a1b2c3d4e5f60718';
const OTHER = '64b7f0c2a1b2c3d4e5f60999';
const env = { CLOUDINARY_CLOUD_NAME: 'democloud', CLOUDINARY_UPLOAD_FOLDER: 'stayeasy' };
const own = `https://res.cloudinary.com/democloud/image/upload/v1700000000/stayeasy/avatars/${ID}.jpg`;

const fakeRes = () => {
  const res = { statusCode: null, body: null };
  res.status = (code) => ((res.statusCode = code), res);
  res.json = (body) => ((res.body = body), res);
  return res;
};

const withEnv = async (vars, fn) => {
  const saved = {};
  for (const k of Object.keys(vars)) {
    saved[k] = process.env[k];
    if (vars[k] === undefined) delete process.env[k];
    else process.env[k] = vars[k];
  }
  try {
    return await fn();
  } finally {
    for (const k of Object.keys(saved)) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
};

test('validateProfileImage: null, empty and blank mean "remove"', () => {
  for (const v of [null, '', '   ']) assert.deepEqual(validateProfileImage(v, ID, env), { value: '' });
});

test('validateProfileImage: accepts the user\'s own Cloudinary avatar, with or without a version', () => {
  assert.equal(validateProfileImage(own, ID, env).value, own);
  const noVersion = `https://res.cloudinary.com/democloud/image/upload/stayeasy/avatars/${ID}.png`;
  assert.equal(validateProfileImage(noVersion, ID, env).value, noVersion);
});

test('validateProfileImage: rejects another user\'s avatar, other clouds/hosts, other folders and unsafe URLs', () => {
  const bad = [
    `https://res.cloudinary.com/democloud/image/upload/v1/stayeasy/avatars/${OTHER}.jpg`,
    `https://res.cloudinary.com/othercloud/image/upload/v1/stayeasy/avatars/${ID}.jpg`,
    `https://evil.example.com/democloud/image/upload/v1/stayeasy/avatars/${ID}.jpg`,
    `https://res.cloudinary.com.evil.example/democloud/image/upload/v1/stayeasy/avatars/${ID}.jpg`,
    `http://res.cloudinary.com/democloud/image/upload/v1/stayeasy/avatars/${ID}.jpg`,
    `https://res.cloudinary.com/democloud/image/upload/v1/stayeasy/hotels/${ID}.jpg`,
    `https://res.cloudinary.com/democloud/image/upload/v1/stayeasy/avatars/${ID}.jpg?track=1`,
    `https://res.cloudinary.com/democloud/image/upload/v1/stayeasy/avatars/${ID}.jpg#x`,
    `https://user:pw@res.cloudinary.com/democloud/image/upload/v1/stayeasy/avatars/${ID}.jpg`,
    `https://res.cloudinary.com/democloud/image/upload/v1/stayeasy/avatars/${ID}/../${OTHER}.jpg`,
    'javascript:alert(1)',
    'data:image/png;base64,AAAA',
    'not a url',
    '/relative/path.jpg',
  ];
  for (const url of bad) {
    const result = validateProfileImage(url, ID, env);
    assert.equal(result.status, 400, `should reject ${url}`);
    assert.ok(result.error);
  }
});

test('validateProfileImage: rejects non-strings and over-long values', () => {
  for (const v of [42, true, ['a'], { $ne: '' }]) assert.equal(validateProfileImage(v, ID, env).status, 400);
  assert.equal(validateProfileImage(`https://res.cloudinary.com/${'a'.repeat(3000)}`, ID, env).status, 400);
});

test('validateProfileImage: setting an image answers 503 when Cloudinary is not configured, removing still works', () => {
  assert.equal(validateProfileImage(own, ID, {}).status, 503);
  assert.deepEqual(validateProfileImage(null, ID, {}), { value: '' });
});

test('validateProfileImage: honours a custom upload folder', () => {
  const custom = { ...env, CLOUDINARY_UPLOAD_FOLDER: 'hotelapp' };
  const url = `https://res.cloudinary.com/democloud/image/upload/v2/hotelapp/avatars/${ID}.webp`;
  assert.equal(validateProfileImage(url, ID, custom).value, url);
  assert.equal(validateProfileImage(own, ID, custom).status, 400);
});

test('buildAvatarUploadParams: public_id is the caller id inside <folder>/avatars', () => {
  const params = buildAvatarUploadParams(ID, env);
  assert.equal(params.folder, 'stayeasy/avatars');
  assert.equal(params.public_id, ID);
  assert.equal(params.overwrite, 'true');
  assert.match(params.allowed_formats, /jpg/);
});

test('signature endpoint: avatar purpose signs the caller\'s own public_id; the secret is never returned', async () => {
  await withEnv(
    { CLOUDINARY_CLOUD_NAME: 'democloud', CLOUDINARY_API_KEY: 'key123', CLOUDINARY_API_SECRET: 'topsecret', CLOUDINARY_UPLOAD_FOLDER: undefined },
    async () => {
      const { getUploadSignature } = require('../src/controllers/uploadController');
      const res = fakeRes();
      await getUploadSignature({ user: { _id: ID, role: 'user' }, body: { purpose: 'avatar', public_id: OTHER } }, res);
      assert.equal(res.statusCode, 200);
      assert.equal(res.body.params.public_id, ID, 'a client-supplied public_id must be ignored');
      assert.equal(res.body.signature, signUploadParams({ ...res.body.params, timestamp: res.body.timestamp }, 'topsecret'));
      assert.ok(!JSON.stringify(res.body).includes('topsecret'));
    }
  );
});

test('signature endpoint: without a purpose the original hotel/room signature shape is returned', async () => {
  await withEnv(
    { CLOUDINARY_CLOUD_NAME: 'democloud', CLOUDINARY_API_KEY: 'key123', CLOUDINARY_API_SECRET: 'topsecret', CLOUDINARY_UPLOAD_FOLDER: undefined },
    async () => {
      const { getUploadSignature } = require('../src/controllers/uploadController');
      const ok = fakeRes();
      await getUploadSignature({ user: { _id: ID, role: 'admin' }, body: {} }, ok);
      assert.equal(ok.statusCode, 200);
      assert.equal(ok.body.folder, 'stayeasy');
      assert.equal(ok.body.params, undefined);
      assert.equal(ok.body.signature, signUploadParams({ folder: 'stayeasy', timestamp: ok.body.timestamp }, 'topsecret'));
    }
  );
});

test('signature route: only avatar requests pass for non-admins; everything else needs the admin role', () => {
  const router = require('../src/routes/uploadRoute');
  const layer = router.stack.find((l) => l.route && l.route.path === '/signature');
  const handlers = layer.route.stack.map((s) => s.handle);
  const gate = handlers[1]; // protect, <gate>, controller
  const run = (user, body) => {
    const res = fakeRes();
    let passed = false;
    gate({ user, body }, res, () => { passed = true; });
    return { passed, status: res.statusCode };
  };
  assert.equal(run({ role: 'user' }, { purpose: 'avatar' }).passed, true);
  assert.equal(run({ role: 'user' }, {}).status, 403);
  assert.equal(run({ role: 'user' }, { purpose: 'hotel' }).status, 403);
  assert.equal(run({ role: 'admin' }, {}).passed, true);
});

test('signature endpoint: 503 when Cloudinary is not configured', async () => {
  await withEnv({ CLOUDINARY_CLOUD_NAME: undefined, CLOUDINARY_API_KEY: undefined, CLOUDINARY_API_SECRET: undefined }, async () => {
    const { getUploadSignature } = require('../src/controllers/uploadController');
    const res = fakeRes();
    await getUploadSignature({ user: { _id: ID, role: 'user' }, body: { purpose: 'avatar' } }, res);
    assert.equal(res.statusCode, 503);
  });
});

test('PUT /users/profile: saves, returns and removes the profile image; role and password are untouched', async () => {
  await withEnv({ CLOUDINARY_CLOUD_NAME: 'democloud', CLOUDINARY_UPLOAD_FOLDER: undefined }, async () => {
    const User = require('../src/models/User');
    const { updateProfile } = require('../src/controllers/userController');
    const stored = { _id: ID, name: 'Ayesha', email: 'a@x.com', role: 'user', profileImage: '', save: async () => {} };
    const original = User.findById;
    User.findById = async () => stored;
    try {
      const set = fakeRes();
      await updateProfile({ user: { _id: ID }, body: { profileImage: own, role: 'admin', password: 'hacked1234' } }, set);
      assert.equal(set.statusCode, 200);
      assert.equal(set.body.profileImage, own);
      assert.equal(set.body.role, 'user');
      assert.equal(stored.role, 'user');
      assert.equal(stored.password, undefined);

      const foreign = fakeRes();
      await updateProfile(
        { user: { _id: ID }, body: { profileImage: `https://res.cloudinary.com/democloud/image/upload/v1/stayeasy/avatars/${OTHER}.jpg` } },
        foreign
      );
      assert.equal(foreign.statusCode, 400);
      assert.equal(stored.profileImage, own, 'a rejected value must not change the stored image');

      const removed = fakeRes();
      await updateProfile({ user: { _id: ID }, body: { profileImage: null } }, removed);
      assert.equal(removed.statusCode, 200);
      assert.equal(removed.body.profileImage, '');

      const nameOnly = fakeRes();
      stored.profileImage = own;
      await updateProfile({ user: { _id: ID }, body: { name: 'Ayesha K' } }, nameOnly);
      assert.equal(nameOnly.body.profileImage, own, 'editing the name must keep the picture');
    } finally {
      User.findById = original;
    }
  });
});
