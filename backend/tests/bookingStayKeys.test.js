// Unit tests for the per-night stay keys that back the unique Booking.stayKeys
// index (src/utils/bookingAvailability.js). No database or network.
// Run with:  npm test
const test = require('node:test');
const assert = require('node:assert/strict');

process.env.BOOKING_TIMEZONE = 'UTC';
const { buildStayKeys, getStayKeys, getOverlapQuery } = require('../src/utils/bookingAvailability');

const d = (date) => new Date(`${date}T00:00:00.000Z`);

test('a stay claims exactly the nights it sleeps, never the check-out day', () => {
  assert.deepEqual(buildStayKeys('room1', d('2026-10-12'), d('2026-10-15')), [
    'room1:2026-10-12',
    'room1:2026-10-13',
    'room1:2026-10-14',
  ]);
  // One night = one key.
  assert.deepEqual(buildStayKeys('room1', d('2026-10-12'), d('2026-10-13')), ['room1:2026-10-12']);
});

test('two bookings that touch back-to-back do not share a night', () => {
  // Guest A leaves on the 15th; guest B arrives on the 15th. That is the normal
  // turnover and must NOT collide.
  const a = buildStayKeys('room1', d('2026-10-12'), d('2026-10-15'));
  const b = buildStayKeys('room1', d('2026-10-15'), d('2026-10-17'));
  assert.equal(a.some((key) => b.includes(key)), false);
});

test('two bookings that truly overlap share at least one night', () => {
  const a = buildStayKeys('room1', d('2026-10-12'), d('2026-10-16'));
  const b = buildStayKeys('room1', d('2026-10-15'), d('2026-10-18'));
  assert.ok(
    a.some((key) => b.includes(key)),
    'overlapping ranges must collide so the unique index rejects the second write'
  );
});

test('the same nights in different rooms never collide', () => {
  const a = buildStayKeys('room1', d('2026-10-12'), d('2026-10-15'));
  const b = buildStayKeys('room2', d('2026-10-12'), d('2026-10-15'));
  assert.equal(a.some((key) => b.includes(key)), false);
});

test('keys count whole UTC days and are unaffected by daylight saving', () => {
  // Spans of real DST changes (US + EU): still exactly one key per night.
  assert.deepEqual(buildStayKeys('r', d('2026-03-28'), d('2026-03-31')).length, 3);
  assert.deepEqual(buildStayKeys('r', d('2026-10-31'), d('2026-11-03')).length, 3);
  // A stored date carrying a time of day still collapses to its calendar day.
  assert.deepEqual(buildStayKeys('r', new Date('2026-10-12T17:45:10.123Z'), d('2026-10-14')), [
    'r:2026-10-12',
    'r:2026-10-13',
  ]);
});

test('a cancelled booking claims nothing, matching the overlap rule', () => {
  assert.deepEqual(getStayKeys('room1', d('2026-10-12'), d('2026-10-15'), 'cancelled'), []);
  // Every other status blocks, exactly like getOverlapQuery (status != cancelled).
  for (const status of ['pending', 'confirmed', 'completed']) {
    assert.equal(getStayKeys('room1', d('2026-10-12'), d('2026-10-15'), status).length, 3, status);
  }
});

test('a cancelled booking cannot block a re-booking of the same nights', () => {
  const cancelled = getStayKeys('room1', d('2026-10-12'), d('2026-10-15'), 'cancelled');
  const newBooking = getStayKeys('room1', d('2026-10-12'), d('2026-10-15'), 'pending');
  assert.equal(cancelled.some((key) => newBooking.includes(key)), false);
});

test('an empty or reversed range claims nothing instead of looping', () => {
  assert.deepEqual(buildStayKeys('room1', d('2026-10-15'), d('2026-10-12')), []);
  assert.deepEqual(buildStayKeys('room1', d('2026-10-12'), d('2026-10-12')), []);
});

test('getOverlapQuery still treats only cancelled bookings as non-blocking', () => {
  assert.deepEqual(getOverlapQuery(d('2026-10-12'), d('2026-10-15')).status, { $ne: 'cancelled' });
});