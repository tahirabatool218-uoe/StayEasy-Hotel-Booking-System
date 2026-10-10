// Request-input validation shared by the auth and user controllers.
//
// Every validator takes `unknown` input (req.body values can be anything the
// client sends: objects, arrays, numbers) and returns either `{ value }` or
// `{ error }`. Nothing here throws, and nothing returns a non-string, so a
// value that passes can be handed to Mongoose or bcrypt safely.

const MAX_NAME_LENGTH = 100;
const MAX_EMAIL_LENGTH = 254;
// New passwords. bcrypt only uses the first 72 bytes, so a longer password
// would be silently truncated; refuse it instead.
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_BYTES = 72;
// Login only needs a sanity cap (no minimum, so accounts created under the old
// 6-character rule can still sign in).
const MAX_LOGIN_PASSWORD_LENGTH = 128;

// Pragmatic email check: one @, no whitespace, a dot in the domain. Real
// verification is only possible by sending mail; this rejects obvious junk.
const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const validateName = (value) => {
  if (typeof value !== 'string') return { error: 'Name must be a string' };
  const name = value.trim();
  if (!name) return { error: 'Name cannot be empty' };
  if (name.length > MAX_NAME_LENGTH) return { error: `Name cannot be longer than ${MAX_NAME_LENGTH} characters` };
  return { value: name };
};

// Trims and lowercases, matching how the User model stores emails.
const validateEmail = (value) => {
  if (typeof value !== 'string') return { error: 'Email must be a string' };
  const email = value.trim().toLowerCase();
  if (!email) return { error: 'Email cannot be empty' };
  if (email.length > MAX_EMAIL_LENGTH) return { error: 'Email is too long' };
  if (!EMAIL_RE.test(email)) return { error: 'Please provide a valid email address' };
  return { value: email };
};

// For choosing a NEW password (register, change-password).
const validateNewPassword = (value) => {
  if (typeof value !== 'string') return { error: 'Password must be a string' };
  if (value.length < MIN_PASSWORD_LENGTH) {
    return { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` };
  }
  if (Buffer.byteLength(value, 'utf8') > MAX_PASSWORD_BYTES) {
    return { error: `Password is too long (maximum ${MAX_PASSWORD_BYTES} bytes)` };
  }
  return { value };
};

// For an EXISTING password being checked (login, current password).
const validateExistingPassword = (value) => {
  if (typeof value !== 'string' || value.length === 0) return { error: 'Password must be a non-empty string' };
  if (value.length > MAX_LOGIN_PASSWORD_LENGTH) return { error: 'Password is too long' };
  return { value };
};

const MAX_IMAGES = 20;
const MAX_IMAGE_URL_LENGTH = 2048;

// Image lists for hotels and rooms: an array of absolute https URLs.
// http, data:, javascript: and relative URLs are refused.
const validateImageUrls = (value) => {
  if (!Array.isArray(value)) return { error: 'images must be an array of https URLs' };
  if (value.length > MAX_IMAGES) return { error: `images cannot contain more than ${MAX_IMAGES} URLs` };
  const urls = [];
  for (const item of value) {
    if (typeof item !== 'string') return { error: 'Every image must be a URL string' };
    const url = item.trim();
    if (!url || url.length > MAX_IMAGE_URL_LENGTH) return { error: 'Every image must be a valid https URL' };
    let parsed;
    try {
      parsed = new URL(url);
    } catch (error) {
      return { error: 'Every image must be a valid https URL' };
    }
    if (parsed.protocol !== 'https:' || !parsed.hostname) {
      return { error: 'Image URLs must use https' };
    }
    urls.push(url);
  }
  return { value: urls };
};

module.exports = {
  isPlainObject,
  validateImageUrls,
  validateName,
  validateEmail,
  validateNewPassword,
  validateExistingPassword,
  MIN_PASSWORD_LENGTH,
  MAX_PASSWORD_BYTES,
};
