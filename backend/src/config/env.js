// Startup validation of environment variables.
//
// Fail fast and loudly: a missing JWT secret or database URI should stop the
// server at boot with a clear message, not surface later as a 500 on the first
// login. `validateEnv` is pure (it only reads the object it is given) so it can
// be unit-tested; `assertEnv` is the thin wrapper server.js calls.

const MIN_JWT_SECRET_LENGTH = 32;

// Placeholder values people paste from tutorials. Rejected in production.
const WEAK_SECRETS = new Set(['secret', 'changeme', 'change_me', 'jwt_secret', 'your_jwt_secret', 'password']);

const isProduction = (env) => env.NODE_ENV === 'production';

const validateEnv = (env = process.env) => {
  const errors = [];
  const warnings = [];
  const production = isProduction(env);

  if (!env.MONGO_URI || !env.MONGO_URI.trim()) {
    errors.push('MONGO_URI is required (your MongoDB connection string).');
  }

  const secret = env.JWT_SECRET || '';
  if (!secret.trim()) {
    errors.push('JWT_SECRET is required. Generate one with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"');
  } else if (production && (secret.length < MIN_JWT_SECRET_LENGTH || WEAK_SECRETS.has(secret.toLowerCase()))) {
    errors.push(`JWT_SECRET must be at least ${MIN_JWT_SECRET_LENGTH} characters and not a placeholder when NODE_ENV=production.`);
  } else if (secret.length < MIN_JWT_SECRET_LENGTH) {
    warnings.push(`JWT_SECRET is shorter than ${MIN_JWT_SECRET_LENGTH} characters. Use a long random value outside local development.`);
  }

  if (env.PORT !== undefined && env.PORT !== '') {
    const port = Number(env.PORT);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      errors.push('PORT must be an integer between 1 and 65535.');
    }
  }

  if (env.BCRYPT_ROUNDS !== undefined && env.BCRYPT_ROUNDS !== '') {
    const rounds = Number(env.BCRYPT_ROUNDS);
    if (!Number.isInteger(rounds) || rounds < 10 || rounds > 15) {
      errors.push('BCRYPT_ROUNDS must be an integer between 10 and 15.');
    }
  }

  for (const name of ['AUTH_RATE_LIMIT_MAX', 'AUTH_REGISTER_LIMIT_MAX', 'API_RATE_LIMIT_MAX']) {
    if (env[name] !== undefined && env[name] !== '') {
      const value = Number(env[name]);
      if (!Number.isInteger(value) || value < 1) {
        errors.push(`${name} must be a positive integer.`);
      }
    }
  }

  if (production && !(env.CORS_ORIGINS || '').split(',').some((o) => o.trim())) {
    errors.push(
      'CORS_ORIGINS is required when NODE_ENV=production (comma-separated list of allowed frontend origins, e.g. https://stayeasy.example.com).'
    );
  }

  return { errors, warnings };
};

const assertEnv = (env = process.env) => {
  const { errors, warnings } = validateEnv(env);
  warnings.forEach((w) => console.warn(`[env] Warning: ${w}`));
  if (errors.length > 0) {
    console.error('Invalid environment configuration:');
    errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }
};

// bcrypt cost factor. Existing hashes keep working whatever this is set to,
// because the cost is stored inside each hash.
const getBcryptRounds = (env = process.env) => {
  const rounds = Number(env.BCRYPT_ROUNDS);
  return Number.isInteger(rounds) && rounds >= 10 && rounds <= 15 ? rounds : 12;
};

module.exports = { validateEnv, assertEnv, getBcryptRounds, MIN_JWT_SECRET_LENGTH };
