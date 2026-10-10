// Cross-cutting request hardening, mounted once in server.js.
const { rateLimit } = require('express-rate-limit');

const MAX_KEY_DEPTH = 20;

// Does any key anywhere in `value` start with "$" or contain "."? Those are
// MongoDB operator / path syntax ({"email": {"$ne": null}}) and never appear
// in this API's legitimate payloads.
const hasOperatorKeys = (value, depth = 0) => {
  if (value === null || typeof value !== 'object') return false;
  if (depth > MAX_KEY_DEPTH) return true; // absurdly deep input: refuse rather than recurse
  if (Array.isArray(value)) return value.some((item) => hasOperatorKeys(item, depth + 1));
  return Object.keys(value).some(
    (key) => key.startsWith('$') || key.includes('.') || hasOperatorKeys(value[key], depth + 1)
  );
};

// NoSQL-injection guard. Rejects the request outright (400) instead of
// silently stripping keys, so a probing client gets an unambiguous answer and
// nothing half-sanitised reaches a query. Controllers still validate types as
// the second layer.
const rejectOperatorKeys = (req, res, next) => {
  if (hasOperatorKeys(req.body) || hasOperatorKeys(req.query) || hasOperatorKeys(req.params)) {
    return res.status(400).json({ message: 'Request contains invalid characters in field names' });
  }
  return next();
};

// Express 5 leaves req.body undefined when a request has no JSON body, and a
// JSON array is also a "valid" body. Every controller destructures req.body
// as an object, so normalise here instead of letting those cases become 500s.
const ensureBodyObject = (req, res, next) => {
  if (req.body === undefined || req.body === null) {
    req.body = {};
    return next();
  }
  if (typeof req.body !== 'object' || Array.isArray(req.body)) {
    return res.status(400).json({ message: 'Request body must be a JSON object' });
  }
  return next();
};

const intFromEnv = (name, fallback) => {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
};

const limiterHandler = (message) => (req, res) => res.status(429).json({ message });

// NOTE: express-rate-limit's default store is in-memory and per process. With
// several instances (or a restart) each keeps its own counters; use a shared
// store such as Redis if the API is scaled out. Behind a reverse proxy, set
// TRUST_PROXY so the client IP (not the proxy's) is what gets counted.
//
// Failed sign-in attempts only: a successful login does not use up the budget.
const createLoginLimiter = () =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: intFromEnv('AUTH_RATE_LIMIT_MAX', 10),
    skipSuccessfulRequests: true,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: limiterHandler('Too many failed attempts. Please wait a few minutes and try again.'),
  });

// Every registration attempt counts, successful or not, to slow account spam.
const createRegisterLimiter = () =>
  rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: intFromEnv('AUTH_REGISTER_LIMIT_MAX', 20),
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: limiterHandler('Too many sign-up attempts from this address. Please try again later.'),
  });

// Broad ceiling for the whole API; generous so normal browsing never hits it.
const createApiLimiter = () =>
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: intFromEnv('API_RATE_LIMIT_MAX', 1000),
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: limiterHandler('Too many requests. Please slow down and try again shortly.'),
  });

// CORS_ORIGINS: comma-separated allowlist. Unset is allowed only outside
// production (env validation refuses to boot a production server without it).
const getCorsOptions = (env = process.env) => {
  const origins = (env.CORS_ORIGINS || '')
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean);

  if (origins.length === 0) return null; // caller falls back to open CORS (development)

  return {
    origin: (origin, callback) => {
      // No Origin header = not a browser cross-origin request (curl, server to server).
      if (!origin || origins.includes(origin)) return callback(null, true);
      return callback(null, false);
    },
    maxAge: 600,
  };
};

// Parses TRUST_PROXY: "1" -> 1 hop, "true"/"false" -> boolean, anything else
// (e.g. "loopback") is passed to Express as-is. Unset means do not trust.
const parseTrustProxy = (value) => {
  if (value === undefined || value === '') return false;
  if (value === 'true') return true;
  if (value === 'false') return false;
  if (/^\d+$/.test(value)) return Number(value);
  return value;
};

module.exports = {
  hasOperatorKeys,
  rejectOperatorKeys,
  ensureBodyObject,
  createLoginLimiter,
  createRegisterLimiter,
  createApiLimiter,
  getCorsOptions,
  parseTrustProxy,
};
