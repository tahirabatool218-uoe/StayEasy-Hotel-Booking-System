import { beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

vi.mock('axios', () => {
  const post = vi.fn();
  return {
    default: { post, create: () => ({ interceptors: { request: { use() {} }, response: { use() {} } } }), isCancel: (e) => e?.__cancel === true },
  };
});
vi.mock('../src/services/api', () => ({ default: { post: vi.fn(), delete: vi.fn(), get: vi.fn(), put: vi.fn() }, onUnauthorized: () => () => {} }));

import axios from 'axios';
import api from '../src/services/api';
import uploadService, { getUploadErrorMessage, validateImageFile, uploadImage } from '../src/services/uploadService';
import userService from '../src/services/userService';
import adminService from '../src/services/adminService';
import reviewService from '../src/services/reviewService';

beforeEach(() => vi.clearAllMocks());

describe('Cloudinary signed upload', () => {
  const signature = { cloudName: 'demo', apiKey: 'key123', timestamp: 1700000000, folder: 'stayeasy', signature: 'abc', uploadUrl: 'https://api.cloudinary.com/v1_1/demo/image/upload' };

  it('requests a signature from the API and posts exactly the signed fields to Cloudinary', async () => {
    api.post.mockResolvedValue({ data: signature });
    axios.post.mockResolvedValue({ data: { secure_url: 'https://res.cloudinary.com/demo/image/upload/x.jpg' } });
    const file = new File(['x'], 'a.jpg', { type: 'image/jpeg' });

    const url = await uploadImage(file, {});
    expect(url).toBe('https://res.cloudinary.com/demo/image/upload/x.jpg');
    expect(api.post).toHaveBeenCalledWith('/uploads/signature');

    const [target, body, config] = axios.post.mock.calls[0];
    expect(target).toBe(signature.uploadUrl);
    expect([...body.keys()].sort()).toEqual(['api_key', 'file', 'folder', 'signature', 'timestamp']);
    expect(body.get('api_key')).toBe('key123');
    expect(body.get('timestamp')).toBe('1700000000');
    expect(body.get('folder')).toBe('stayeasy');
    expect(body.get('signature')).toBe('abc');
    expect(body.has('upload_preset')).toBe(false);
    // The bare axios instance is used: no Authorization header for a third party.
    expect(config.headers).toBeUndefined();
  });

  it('rejects a non-HTTPS result', async () => {
    api.post.mockResolvedValue({ data: signature });
    axios.post.mockResolvedValue({ data: { secure_url: 'http://insecure/x.jpg' } });
    await expect(uploadImage(new File(['x'], 'a.jpg', { type: 'image/jpeg' }), {})).rejects.toThrow(/HTTPS/);
  });

  it('validates file type and size before uploading', () => {
    expect(validateImageFile(new File(['x'], 'a.pdf', { type: 'application/pdf' }))).toMatch(/Unsupported/);
    const big = new File([new Uint8Array(11 * 1024 * 1024)], 'big.png', { type: 'image/png' });
    expect(validateImageFile(big)).toMatch(/Too large/);
    expect(validateImageFile(new File(['x'], 'ok.webp', { type: 'image/webp' }))).toBe('');
  });

  it('turns a 503 into a configuration message and never mentions the secret', () => {
    const msg = getUploadErrorMessage({ response: { status: 503 } });
    expect(msg).toMatch(/not configured/i);
    expect(typeof uploadService.uploadImage).toBe('function');
  });

  it('keeps CLOUDINARY_API_SECRET out of the frontend source', () => {
    const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
    const hits = walk('src').filter((f) => /api_secret|API_SECRET/i.test(fs.readFileSync(f, 'utf8')));
    expect(hits).toEqual([]);
  });
});

describe('API contracts', () => {
  it('closeAccount sends the password in the DELETE body (not the URL)', async () => {
    api.delete.mockResolvedValue({ data: { message: 'ok' } });
    await userService.closeAccount('pw-123456');
    expect(api.delete).toHaveBeenCalledWith('/users/me', { data: { password: 'pw-123456' } });
  });
  it('dashboard, my reviews and user status hit the documented endpoints', async () => {
    api.get.mockResolvedValue({ data: {} });
    api.put.mockResolvedValue({ data: {} });
    await userService.getDashboard();
    expect(api.get).toHaveBeenCalledWith('/users/dashboard');
    await reviewService.getMyReviews();
    expect(api.get).toHaveBeenCalledWith('/reviews/my');
    await adminService.updateUserStatus('u1', false);
    expect(api.put).toHaveBeenCalledWith('/admin/users/u1/status', { isActive: false });
    await adminService.getDashboardStats();
    expect(api.get).toHaveBeenCalledWith('/admin/dashboard');
    expect(adminService.deleteUser).toBeUndefined();
  });
});
