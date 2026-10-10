/**
 * Seed credential loading and validation.
 *
 * There are deliberately NO built-in passwords anywhere in this project. The
 * passwords must be supplied through the environment (see .env.example) and
 * are validated before the seeder touches the database.
 *
 * Error messages name the environment variable that is wrong and the rule
 * that was broken — they never contain a password value.
 */

const MIN_PASSWORD_LENGTH = 8; // same 8-72 byte policy as validateNewPassword
const MAX_PASSWORD_BYTES = 72; // bcrypt ignores everything after 72 bytes
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Emails are identifiers, not secrets, so they keep the project's existing
// sample addresses as defaults. Passwords have no default.
const DEFAULT_ADMIN_EMAIL = 'admin@stayeasy.com';
const DEFAULT_USER_EMAIL = 'guest@stayeasy.com';

// Seed user definitions WITHOUT passwords. Passwords only ever come from env.
const SEED_USER_DEFINITIONS = [
  { name: 'StayEasy Admin', role: 'admin', emailVar: 'SEED_ADMIN_EMAIL', defaultEmail: DEFAULT_ADMIN_EMAIL },
  { name: 'Ali Guest', role: 'user', emailVar: 'SEED_USER_EMAIL', defaultEmail: DEFAULT_USER_EMAIL },
];

/** Seed users without any password field (safe to export, log or inspect). */
function describeSeedUsers(env = process.env) {
  return SEED_USER_DEFINITIONS.map(({ name, role, emailVar, defaultEmail }) => ({
    name,
    role,
    email: (readValue(env, emailVar).trim() || defaultEmail).toLowerCase(),
  }));
}

class SeedConfigError extends Error {
  constructor(problems) {
    super(
      `Seeding refused: ${problems.join('; ')}. ` +
        'Set the SEED_* variables in backend/.env (see .env.example) and run the seed again. Nothing was written.'
    );
    this.name = 'SeedConfigError';
    this.problems = problems;
  }
}

function readValue(env, name) {
  const value = env[name];
  return typeof value === 'string' ? value : '';
}

function checkPassword(name, password, problems) {
  if (password.trim() === '') {
    problems.push(`${name} is not set`);
    return false;
  }
  if (password !== password.trim()) {
    problems.push(`${name} must not start or end with whitespace`);
    return false;
  }
  const bytes = Buffer.byteLength(password, 'utf8');
  if (bytes < MIN_PASSWORD_LENGTH || bytes > MAX_PASSWORD_BYTES) {
    problems.push(`${name} must be ${MIN_PASSWORD_LENGTH}-${MAX_PASSWORD_BYTES} bytes long`);
    return false;
  }
  return true;
}

function checkEmail(name, rawValue, fallback, problems) {
  const email = (rawValue.trim() || fallback).toLowerCase();
  if (!EMAIL_PATTERN.test(email)) {
    problems.push(`${name} must be a valid email address`);
    return null;
  }
  return email;
}

/**
 * Read and validate ONLY the two seed passwords from an environment object.
 * Throws SeedConfigError (message never contains a password value).
 * Returns an object keyed by environment variable name:
 *   { SEED_ADMIN_PASSWORD, SEED_USER_PASSWORD }
 * (non-enumerable `admin` / `user` aliases are also provided for convenience).
 */
function resolveSeedPasswords(env = process.env) {
  const problems = [];
  const admin = readValue(env, 'SEED_ADMIN_PASSWORD');
  const user = readValue(env, 'SEED_USER_PASSWORD');
  const adminOk = checkPassword('SEED_ADMIN_PASSWORD', admin, problems);
  const userOk = checkPassword('SEED_USER_PASSWORD', user, problems);
  if (adminOk && userOk && admin === user) {
    problems.push('SEED_ADMIN_PASSWORD and SEED_USER_PASSWORD must be different from each other');
  }
  if (problems.length > 0) throw new SeedConfigError(problems);
  const result = { SEED_ADMIN_PASSWORD: admin, SEED_USER_PASSWORD: user };
  Object.defineProperty(result, 'admin', { value: admin, enumerable: false });
  Object.defineProperty(result, 'user', { value: user, enumerable: false });
  return result;
}

/**
 * Build the list of users to seed from an environment object.
 * Throws SeedConfigError if anything required is missing or invalid.
 */
function buildSeedUsers(env = process.env) {
  const problems = [];
  const adminEmail = checkEmail('SEED_ADMIN_EMAIL', readValue(env, 'SEED_ADMIN_EMAIL'), DEFAULT_ADMIN_EMAIL, problems);
  const userEmail = checkEmail('SEED_USER_EMAIL', readValue(env, 'SEED_USER_EMAIL'), DEFAULT_USER_EMAIL, problems);
  if (adminEmail && userEmail && adminEmail === userEmail) {
    problems.push('SEED_ADMIN_EMAIL and SEED_USER_EMAIL must be different addresses');
  }

  let passwords = null;
  try {
    passwords = resolveSeedPasswords(env);
  } catch (error) {
    if (!(error instanceof SeedConfigError)) throw error;
    problems.push(...error.problems);
  }

  if (problems.length > 0) throw new SeedConfigError(problems);

  return [
    { name: 'StayEasy Admin', email: adminEmail, password: passwords.admin, role: 'admin' },
    { name: 'Ali Guest', email: userEmail, password: passwords.user, role: 'user' },
  ];
}

/** Remove any secret value from a piece of text before it is logged. */
function redact(text, secrets) {
  let output = String(text);
  for (const secret of secrets) {
    if (secret) output = output.split(secret).join('[redacted]');
  }
  return output;
}

module.exports = { buildSeedUsers, resolveSeedPasswords, describeSeedUsers, redact, SeedConfigError, MIN_PASSWORD_LENGTH, MAX_PASSWORD_BYTES };
