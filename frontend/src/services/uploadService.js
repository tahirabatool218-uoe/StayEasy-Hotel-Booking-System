import axios from 'axios';
import api from './api';

// Cloudinary signed uploads, using the contract of POST /api/uploads/signature:
//   200 -> { cloudName, apiKey, timestamp, folder, signature, uploadUrl }
//   503 -> uploads are not configured on the server (CLOUDINARY_* missing)
// The backend signs exactly { folder, timestamp }, so the browser must send those
// two fields unchanged along with `file`, `api_key` and `signature`. No upload
// preset is involved, and the API secret never leaves the server.
export const MAX_IMAGES = 20;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
export const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];

// Returns an error string for an unusable file, or '' when it can be uploaded.
export const validateImageFile = (file) => {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return 'Unsupported file type. Use JPG, PNG, WebP, GIF or AVIF.';
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return `Too large (${(file.size / 1024 / 1024).toFixed(1)} MB). The limit is ${MAX_IMAGE_BYTES / 1024 / 1024} MB.`;
  }
  if (file.size === 0) return 'This file is empty.';
  return '';
};

// Turns whatever failed (our API or Cloudinary) into a message worth showing.
export const getUploadErrorMessage = (error) => {
  if (axios.isCancel(error)) return 'Upload cancelled.';
  const status = error?.response?.status;
  if (status === 503) {
    return 'Image uploads are not configured on the server yet. Ask the site owner to set the Cloudinary environment variables, or paste an image URL instead.';
  }
  if (status === 401) return 'Your session has expired. Please sign in again.';
  if (status === 403) return 'Only administrators can upload images.';
  const cloudinaryMessage = error?.response?.data?.error?.message;
  if (cloudinaryMessage) return `Cloudinary rejected the upload: ${cloudinaryMessage}`;
  const apiMessage = error?.response?.data?.message;
  if (apiMessage) return apiMessage;
  if (error?.code === 'ERR_NETWORK') return 'Network error. Check your connection and try again.';
  return 'The upload failed. Please try again.';
};

const requestSignature = async () => {
  const { data } = await api.post('/uploads/signature');
  if (!data?.signature || !data?.apiKey || !data?.uploadUrl) {
    throw new Error('The server returned an incomplete upload signature.');
  }
  return data;
};

// Uploads one file straight to Cloudinary and resolves with its HTTPS URL.
// A fresh signature is requested per file so a long batch never outlives one.
// Cloudinary is called with a bare axios instance: our API instance would add
// the JWT (and its base URL), which must never be sent to a third party.
export const uploadImage = async (file, { onProgress, signal } = {}) => {
  const sig = await requestSignature();

  const body = new FormData();
  body.append('file', file);
  body.append('api_key', sig.apiKey);
  body.append('timestamp', String(sig.timestamp));
  body.append('folder', sig.folder);
  body.append('signature', sig.signature);

  const { data } = await axios.post(sig.uploadUrl, body, {
    signal,
    onUploadProgress: (event) => {
      if (onProgress && event.total) onProgress(Math.round((event.loaded / event.total) * 100));
    },
  });

  const url = data?.secure_url;
  if (typeof url !== 'string' || !url.startsWith('https://')) {
    throw new Error('Cloudinary did not return an HTTPS image URL.');
  }
  return url;
};

// ---- Profile pictures -----------------------------------------------------
// Any signed-in user may upload their OWN avatar. The backend signs a fixed
// public_id (their user id) plus a few extra fields and lists them in
// `params`; all of them must be sent to Cloudinary exactly as signed. A new
// upload replaces the previous one, and Cloudinary's CDN URL changes with it.
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5 MB

export const validateAvatarFile = (file) => {
  if (!file) return 'Choose an image first.';
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return 'Unsupported file type. Use JPG, PNG, WebP, GIF or AVIF.';
  }
  if (file.size === 0) return 'This file is empty.';
  if (file.size > MAX_AVATAR_BYTES) {
    return `Too large (${(file.size / 1024 / 1024).toFixed(1)} MB). The limit is ${MAX_AVATAR_BYTES / 1024 / 1024} MB.`;
  }
  return '';
};

// 403 cannot mean "admins only" here, so it keeps the generic wording.
export const getAvatarUploadErrorMessage = (error) => {
  if (error?.response?.status === 403) return 'You are not allowed to upload a profile photo.';
  if (error?.response?.status === 503) return 'Photo uploads are not available right now. Please try again later.';
  return getUploadErrorMessage(error);
};

export const uploadAvatar = async (file, { onProgress, signal } = {}) => {
  const { data: sig } = await api.post('/uploads/signature', { purpose: 'avatar' });
  if (!sig?.signature || !sig?.apiKey || !sig?.uploadUrl || !sig?.params) {
    throw new Error('The server returned an incomplete upload signature.');
  }

  const body = new FormData();
  body.append('file', file);
  body.append('api_key', sig.apiKey);
  body.append('timestamp', String(sig.timestamp));
  Object.entries(sig.params).forEach(([key, value]) => body.append(key, String(value)));
  body.append('signature', sig.signature);

  // Bare axios on purpose: our API instance would send the JWT to Cloudinary.
  const { data } = await axios.post(sig.uploadUrl, body, {
    signal,
    onUploadProgress: (event) => {
      if (onProgress && event.total) onProgress(Math.round((event.loaded / event.total) * 100));
    },
  });

  const url = data?.secure_url;
  if (typeof url !== 'string' || !url.startsWith('https://')) {
    throw new Error('Cloudinary did not return an HTTPS image URL.');
  }
  return url;
};

export default { uploadImage, validateImageFile, uploadAvatar, validateAvatarFile };
