require('dotenv').config();

// Refuse to boot with a missing/weak JWT secret or database URI, before
// anything else loads (some modules read BOOKING_TIMEZONE etc. at import time).
require('./src/config/env').assertEnv();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const {
  rejectOperatorKeys,
  ensureBodyObject,
  createApiLimiter,
  getCorsOptions,
  parseTrustProxy,
} = require('./src/middleware/security');
const connectDB = require('./src/config/db');
const authRoutes = require('./src/routes/authRoutes');
const hotelRoutes = require('./src/routes/hotelRoute');
const roomRoutes = require('./src/routes/roomRoute');
const bookingRoutes = require('./src/routes/bookingRoute');
const reviewRoutes = require('./src/routes/reviewRoute');
const adminRoutes = require('./src/routes/adminRoute');
const userRoutes = require('./src/routes/userRoute');
const uploadRoutes = require('./src/routes/uploadRoute');

const app = express();

connectDB();

// Needed for correct client IPs (rate limiting) behind a reverse proxy/load balancer.
app.set('trust proxy', parseTrustProxy(process.env.TRUST_PROXY));

// Security headers. The API returns JSON only, so cross-origin resource policy
// is relaxed to let the separately hosted frontend read responses.
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// CORS allowlist from CORS_ORIGINS. When unset (development only; env
// validation requires it in production) every origin is allowed, as before.
app.use(cors(getCorsOptions() || undefined));

app.use(createApiLimiter());

// Request-size cap: bodies above the limit are answered 413 by the error
// handler below. Hotel/room payloads are text and URLs, far under 100 kB.
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '100kb' }));
app.use(ensureBodyObject);
app.use(rejectOperatorKeys);

app.get('/', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Hotel Booking API is running' });
});

app.use('/api/auth', authRoutes);
app.use('/api/hotels', hotelRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/users', userRoutes);
app.use('/api/uploads', uploadRoutes);

// Unmatched route -> JSON, never Express's default HTML 404. The frontend
// axios client always parses responses as JSON, so an HTML body here would
// surface as an unhelpful parse error instead of a readable message.
app.use((req, res) => {
  res.status(404).json({
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// Centralised error handler. Controllers already handle their own expected
// failures; this is the last-resort net for anything thrown outside them
// (malformed JSON bodies, Mongoose/cast errors, unexpected exceptions).
// The four-argument signature is what marks this as an error handler in
// Express, so `next` must stay even though it is unused.
app.use((error, req, res, next) => {
  // Malformed JSON from express.json() — a client error, not a server fault.
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return res.status(400).json({ message: 'Malformed JSON in request body' });
  }

  if (error && error.type === 'entity.too.large') {
    return res.status(413).json({ message: 'Request body is too large' });
  }

  console.error('Unhandled error:', error);

  // Internal messages (which can contain connection strings, field values or
  // stack traces) never reach the client, in any environment. The full error
  // is in the server log above.
  return res.status(500).json({ message: 'Server error' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
