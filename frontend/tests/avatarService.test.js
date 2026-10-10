import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('axios', () => {
  const post = vi.fn();
  return {
    default: { post, create: () => ({ interceptors: { request: { use() {} }, response: { use() {} } } }), isCancel: (e) => e?.__cancel === true },
  };
});
vi.mock('../src/services/api', () => ({ default: { post: vi.fn(), delete: vi.fn(), get: vi.fn(), put: vi.fn() }, onUnauthorized: () => () => {} }));

import axios from 'axios';
import api from '../src/services/api';
import { uploadAvatar, validateAvatarFile, getAvatarUploadErrorMessage, MAX_AVATAR_BYTES } from '../src/services/uploadService';
import userService from '../src/services/userService';

beforeEach(() => vi.clearAllMocks());

const signature = {
  cloudName: 'demo',
  apiKey: 'key123',
  timestamp: 1700000000,
  folder: 'stayeasy/avatars',
  signature: 'abc',
  uploadUrl: 'https://api.cloudinary.com/v1_1/demo/image/upload',
  params: { folder: 'stayeasy/avatars', public_id: 'u1', overwrite: 'true', invalidate: 'true', allowed_formats: 'jpg,png' },
};

describe('uploadAvatar', () => {
  it('asks for an avatar signature and sends every signed field to Cloudinary without the JWT', async () => {
    api.post.mockResolvedValue({ data: signature });
    axios.post.mockResolvedValue({ data: { secure_url: 'https://res.cloudinary.com/demo/image/upload/v1/stayeasy/avatars/u1.jpg' } });

    const url = await uploadAvatar(new File(['x'], 'me.jpg', { type: 'image/jpeg' }));
    expect(url).toMatch(/^https:\/\/res\.cloudinary\.com\//);
    expect(api.post).toHaveBeenCalledWith('/uploads/signature', { purpose: 'avatar' });

    const [target, body, config] = axios.post.mock.calls[0];
    expect(target).toBe(signature.uploadUrl);
    expect([...body.keys()].sort()).toEqual(
      ['allowed_formats', 'api_key', 'file', 'folder', 'invalidate', 'overwrite', 'public_id', 'signature', 'timestamp']
    );
    expect(body.get('public_id')).toBe('u1');
    expect(body.get('signature')).toBe('abc');
    expect(config.headers).toBeUndefined();
  });

  it('refuses an incomplete signature and a non-HTTPS result', async () => {
    api.post.mockResolvedValue({ data: { ...signature, params: undefined } });
    await expect(uploadAvatar(new File(['x'], 'a.jpg', { type: 'image/jpeg' }))).rejects.toThrow(/incomplete/);

    api.post.mockResolvedValue({ data: signature });
    axios.post.mockResolvedValue({ data: { secure_url: 'http://insecure/x.jpg' } });
    await expect(uploadAvatar(new File(['x'], 'a.jpg', { type: 'image/jpeg' }))).rejects.toThrow(/HTTPS/);
  });
});

describe('validateAvatarFile / errors / updateProfileImage', () => {
  it('checks type, emptiness and the 5 MB limit', () => {
    expect(validateAvatarFile(new File(['x'], 'a.pdf', { type: 'application/pdf' }))).toMatch(/Unsupported/);
    expect(validateAvatarFile(new File([], 'a.png', { type: 'image/png' }))).toMatch(/empty/);
    const big = new File([new Uint8Array(MAX_AVATAR_BYTES + 1)], 'big.png', { type: 'image/png' });
    expect(validateAvatarFile(big)).toMatch(/Too large/);
    expect(validateAvatarFile(new File(['x'], 'ok.webp', { type: 'image/webp' }))).toBe('');
  });

  it('gives readable messages for expired sessions, missing configuration and network failures', () => {
    expect(getAvatarUploadErrorMessage({ response: { status: 401 } })).toMatch(/expired/);
    expect(getAvatarUploadErrorMessage({ response: { status: 503 } })).toMatch(/not available/);
    expect(getAvatarUploadErrorMessage({ response: { status: 403 } })).not.toMatch(/administrators/i);
    expect(getAvatarUploadErrorMessage({ code: 'ERR_NETWORK' })).toMatch(/Network/);
  });

  it('saves and removes through PUT /users/profile', async () => {
    api.put.mockResolvedValue({ data: { profileImage: 'https://x' } });
    await userService.updateProfileImage('https://x');
    expect(api.put).toHaveBeenLastCalledWith('/users/profile', { profileImage: 'https://x' });
    await userService.updateProfileImage('');
    expect(api.put).toHaveBeenLastCalledWith('/users/profile', { profileImage: null });
  });
});
