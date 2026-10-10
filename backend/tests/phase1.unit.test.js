const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');

const { signUploadParams } = require('../src/utils/cloudinarySignature');
const { validateImageUrls } = require('../src/utils/validators');
const { getUploadSignature } = require('../src/controllers/uploadController');
const User = require('../src/models/User');

const fakeRes = () => {
  const res = { statusCode: 200, body: undefined };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  return res;
};

describe('Cloudinary signature', () => {
  test("matches Cloudinary's published documentation example", () => {
    const signature = signUploadParams(
      { eager: 'w_400,h_300,c_pad|w_260,h_200,c_crop', public_id: 'sample_image', timestamp: 1315060510 },
      'abcd'
    );
    assert.strictEqual(signature, 'bfd09f95f331f558cbd1320e67aa8d488770583e');
  });

  test('ignores file, cloud_name, resource_type and api_key, and sorts keys', () => {
    const a = signUploadParams({ timestamp: 1, folder: 'x' }, 's');
    const b = signUploadParams({ folder: 'x', api_key: 'k', file: 'f', cloud_name: 'c', resource_type: 'image', timestamp: 1 }, 's');
    assert.strictEqual(a, b);
  });
});

describe('validateImageUrls', () => {
  test('accepts https URLs and trims them', () => {
    assert.deepStrictEqual(validateImageUrls([' https://res.cloudinary.com/x/a.jpg ']).value, ['https://res.cloudinary.com/x/a.jpg']);
    assert.deepStrictEqual(validateImageUrls([]).value, []);
  });

  test('rejects http, data, javascript, relative, empty and non-string entries', () => {
    for (const bad of ['http://a.com/x.jpg', 'data:image/png;base64,AAAA', 'javascript:alert(1)', '/x.jpg', '', 'not a url', 42, null, {}]) {
      assert.ok(validateImageUrls([bad]).error, `should reject ${JSON.stringify(bad)}`);
    }
  });

  test('rejects non-arrays, oversized lists and over-long URLs', () => {
    assert.ok(validateImageUrls('https://a.com/x.jpg').error);
    assert.ok(validateImageUrls(Array(21).fill('https://a.com/x.jpg')).error);
    assert.ok(validateImageUrls([`https://a.com/${'a'.repeat(2100)}`]).error);
  });
});

describe('POST /api/uploads/signature controller', () => {
  const keys = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET', 'CLOUDINARY_UPLOAD_FOLDER'];
  const saved = {};
  beforeEach(() => keys.forEach((k) => { saved[k] = process.env[k]; delete process.env[k]; }));
  afterEach(() => keys.forEach((k) => { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }));

  test('answers 503 when Cloudinary is not configured', async () => {
    const res = fakeRes();
    await getUploadSignature({}, res);
    assert.strictEqual(res.statusCode, 503);
  });

  test('returns a verifiable signature and never the secret', async () => {
    process.env.CLOUDINARY_CLOUD_NAME = 'demo';
    process.env.CLOUDINARY_API_KEY = 'key123';
    process.env.CLOUDINARY_API_SECRET = 'test-only-secret';
    const res = fakeRes();
    await getUploadSignature({}, res);
    assert.strictEqual(res.statusCode, 200);
    const { signature, timestamp, folder } = res.body;
    assert.strictEqual(folder, 'stayeasy');
    assert.strictEqual(signature, signUploadParams({ folder, timestamp }, 'test-only-secret'));
    assert.ok(!JSON.stringify(res.body).includes('test-only-secret'));
    assert.strictEqual(res.body.uploadUrl, 'https://api.cloudinary.com/v1_1/demo/image/upload');
  });
});

describe('User.isUserActive', () => {
  test('legacy accounts without the flag count as active; only false is inactive', () => {
    assert.strictEqual(User.isUserActive({}), true);
    assert.strictEqual(User.isUserActive({ isActive: true }), true);
    assert.strictEqual(User.isUserActive({ isActive: false }), false);
    assert.strictEqual(User.isUserActive(null), false);
  });
});
