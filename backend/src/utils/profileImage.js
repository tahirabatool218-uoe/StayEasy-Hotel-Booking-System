// Profile-image (avatar) rules shared by the upload-signature endpoint and the
// profile controller.
//
// Each user owns exactly one Cloudinary asset: `<folder>/avatars/<userId>`.
// The signature endpoint signs that public_id, and the profile endpoint accepts
// only a URL that points at it. A user therefore cannot save an arbitrary
// address (tracking pixel, someone else's avatar, a hotel photo) as their
// picture, even with a valid token.

const AVATAR_SUBFOLDER = 'avatars';
const MAX_PROFILE_IMAGE_URL_LENGTH = 2048;
// Signed into the upload, so Cloudinary itself refuses other formats.
const AVATAR_ALLOWED_FORMATS = 'jpg,jpeg,png,webp,gif,avif';

const escapeForRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getBaseFolder = (env = process.env) => (env.CLOUDINARY_UPLOAD_FOLDER || 'stayeasy').trim();
const getAvatarFolder = (env = process.env) => `${getBaseFolder(env)}/${AVATAR_SUBFOLDER}`;
const getCloudName = (env = process.env) => (env.CLOUDINARY_CLOUD_NAME || '').trim();

// Params the browser must send to Cloudinary exactly as signed. `timestamp` is
// added by the caller.
const buildAvatarUploadParams = (userId, env = process.env) => ({
  folder: getAvatarFolder(env),
  public_id: String(userId),
  overwrite: 'true',
  invalidate: 'true',
  allowed_formats: AVATAR_ALLOWED_FORMATS,
});

// Accepts '' / null (remove) or this user's own Cloudinary avatar URL.
// Returns { value } ('' for removal) or { error, status }.
const validateProfileImage = (input, userId, env = process.env) => {
  if (input === null || input === '') return { value: '' };
  if (typeof input !== 'string') return { error: 'profileImage must be a URL string or null', status: 400 };

  const raw = input.trim();
  if (!raw) return { value: '' };
  if (raw.length > MAX_PROFILE_IMAGE_URL_LENGTH) return { error: 'Profile image URL is too long', status: 400 };

  const cloudName = getCloudName(env);
  if (!cloudName) return { error: 'Image uploads are not configured on the server', status: 503 };

  let url;
  try {
    url = new URL(raw);
  } catch {
    return { error: 'Profile image must be a valid https URL', status: 400 };
  }

  const pattern = new RegExp(
    `^/${escapeForRegExp(cloudName)}/image/upload/(?:v\\d+/)?${escapeForRegExp(getAvatarFolder(env))}/${escapeForRegExp(String(userId))}(?:\\.[A-Za-z0-9]+)?$`
  );
  const ok =
    url.protocol === 'https:' &&
    url.hostname === 'res.cloudinary.com' &&
    !url.username &&
    !url.password &&
    !url.port &&
    !url.search &&
    !url.hash &&
    pattern.test(url.pathname);

  if (!ok) return { error: 'Profile image must be an image uploaded to your own account', status: 400 };
  return { value: url.toString() };
};

module.exports = {
  AVATAR_ALLOWED_FORMATS,
  buildAvatarUploadParams,
  getAvatarFolder,
  validateProfileImage,
};
