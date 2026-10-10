// Unit tests for src/utils/bookingValidation.js. No database or network.
// Run with:  npm test
const test = require('node:test');
const assert = require('node:assert/strict');

process.env.BOOKING_TIMEZONE = 'Asia/Karachi';
const {
  parseCalendarDate,
  startOfUtcDay,
  calculateNights,
  getToday,
  validateStayRange,
  parseGuests,
  calculateTotalPrice,
  getBookabilityError,
  getCapacityError,
} = require('../src/utils/bookingValidation');

const iso = (date) => date.toISOString().slice(0, 10);

test('parseCalendarDate accepts real YYYY-MM-DD dates as midnight UTC', () => {
  const date = parseCalendarDate('2026-10-12');
  assert.equal(date.toISOString(), '2026-10-12T00:00:00.000Z');
  assert.equal(iso(parseCalendarDate('2028-02-29')), '2028-02-29'); // leap day
});

test('parseCalendarDate accepts the midnight-UTC ISO form the API itself returns', () => {
  assert.equal(parseCalendarDate('2026-10-12T00:00:00.000Z').toISOString(), '2026-10-12T00:00:00.000Z');
  assert.equal(parseCalendarDate('2026-10-12T00:00:00Z').toISOString(), '2026-10-12T00:00:00.000Z');
});

test('parseCalendarDate rejects impossible, malformed and ambiguous input', () => {
  const bad = [
    '2026-02-31', // impossible day
    '2027-02-29', // not a leap year
    '2026-13-01',
    '2026-00-10',
    '0050-01-01', // Date.UTC would silently map years 0-99 to 19xx
    '2026-1-5',
    '12/10/2026',
    '',
    'not a date',
    '2026-10-12T10:30:00Z', // non-midnight timestamp: which calendar day?
    '2026-03-29T23:30:00+01:00',
    '2026-10-12T00:00:00+05:00', // midnight but not UTC
    1791612405304, // numeric timestamp
    null,
    undefined,
    {},
    ['2026-10-12'],
    true,
  ];
  for (const value of bad) {
    assert.equal(parseCalendarDate(value), null, `expected ${JSON.stringify(value)} to be rejected`);
  }
});

test('calculateNights counts calendar days and is unaffected by DST or time of day', () => {
  const nights = (a, b) => calculateNights(parseCalendarDate(a), parseCalendarDate(b));
  assert.equal(nights('2026-10-12', '2026-10-13'), 1);
  assert.equal(nights('2026-10-12', '2026-10-19'), 7);
  // Spans of real-world DST changes (US + EU): must still be whole nights.
  assert.equal(nights('2026-03-07', '2026-03-10'), 3);
  assert.equal(nights('2026-03-28', '2026-03-31'), 3);
  assert.equal(nights('2026-10-24', '2026-10-27'), 3);
  assert.equal(nights('2026-10-31', '2026-11-03'), 3);
  // Year boundary and leap day.
  assert.equal(nights('2026-12-30', '2027-01-02'), 3);
  assert.equal(nights('2028-02-28', '2028-03-01'), 2);
});

test('calculateNights ignores time-of-day on legacy stored dates (no ceil() overcharge)', () => {
  // The old implementation was Math.ceil(ms / 86400000): a stored check-out a
  // few hours "late" would have added a whole extra night.
  const checkIn = new Date('2026-10-12T00:00:00.000Z');
  const lateCheckOut = new Date('2026-10-14T05:00:00.000Z');
  assert.equal(calculateNights(checkIn, lateCheckOut), 2);
});

test('getToday uses the booking timezone, not the server clock zone', () => {
  // 2026-10-10 20:00 UTC is already 01:00 on the 11th in Karachi (UTC+5)...
  const instant = new Date('2026-10-10T20:00:00Z');
  assert.equal(iso(getToday(instant, 'Asia/Karachi')), '2026-10-11');
  assert.equal(iso(getToday(instant, 'UTC')), '2026-10-10');
  // ...and still the 10th in New York (UTC-4).
  assert.equal(iso(getToday(instant, 'America/New_York')), '2026-10-10');
});

test('validateStayRange: order, minimum one night, past check-in', () => {
  const today = parseCalendarDate('2026-10-10');
  const d = parseCalendarDate;

  assert.equal(validateStayRange(d('2026-10-12'), d('2026-10-13'), { requireFutureCheckIn: true, today }), null);
  // Check-in today is allowed; yesterday is not.
  assert.equal(validateStayRange(d('2026-10-10'), d('2026-10-11'), { requireFutureCheckIn: true, today }), null);
  assert.match(
    validateStayRange(d('2026-10-09'), d('2026-10-11'), { requireFutureCheckIn: true, today }),
    /past/
  );
  // Same-day and reversed ranges.
  assert.match(validateStayRange(d('2026-10-12'), d('2026-10-12'), { today }), /later than/);
  assert.match(validateStayRange(d('2026-10-13'), d('2026-10-12'), { today }), /later than/);
  // Past dates are fine when the caller does not ask for the future-only rule.
  assert.equal(validateStayRange(d('2026-01-01'), d('2026-01-03'), { today }), null);
});

test('parseGuests accepts whole numbers >= 1 only', () => {
  assert.deepEqual(parseGuests(1), { guests: 1 });
  assert.deepEqual(parseGuests(4), { guests: 4 });
  assert.deepEqual(parseGuests('3'), { guests: 3 }); // query-string form

  for (const value of [0, -1, '0', '-2']) {
    assert.match(parseGuests(value).error, /at least 1/, `value ${JSON.stringify(value)}`);
  }
  for (const value of [1.5, '1.5', NaN, Infinity, 2 ** 60, '', ' ', 'abc', true, false, null, undefined, [], [2], {}]) {
    assert.match(parseGuests(value).error, /whole number/, `value ${JSON.stringify(value)}`);
  }
});

test('calculateTotalPrice rounds to cents', () => {
  assert.equal(calculateTotalPrice(100, 3), 300);
  assert.equal(calculateTotalPrice(99.99, 3), 299.97); // raw JS gives 299.96999999999997
  assert.equal(calculateTotalPrice(0, 5), 0);
});

test('getBookabilityError / getCapacityError', () => {
  const hotel = { _id: 'h1', isActive: true };
  const room = { hotel: 'h1', status: 'available', capacity: 2 };

  assert.equal(getBookabilityError(hotel, room), null);
  assert.match(getBookabilityError({ ...hotel, isActive: false }, room), /not currently available/);
  assert.match(getBookabilityError(hotel, { ...room, hotel: 'h2' }), /does not belong/);
  assert.match(getBookabilityError(hotel, { ...room, status: 'maintenance' }), /maintenance/);

  assert.equal(getCapacityError(room, 2), null);
  assert.match(getCapacityError(room, 3), /exceed capacity/);
});

test('startOfUtcDay strips the time component', () => {
  assert.equal(startOfUtcDay(new Date('2026-10-12T17:45:10.123Z')).toISOString(), '2026-10-12T00:00:00.000Z');
});

test('an invalid BOOKING_TIMEZONE fails loudly at load time', () => {
  const modulePath = require.resolve('../src/utils/bookingValidation');
  const saved = process.env.BOOKING_TIMEZONE;
  try {
    process.env.BOOKING_TIMEZONE = 'Not/AZone';
    delete require.cache[modulePath];
    assert.throws(() => require('../src/utils/bookingValidation'), /Invalid BOOKING_TIMEZONE/);
  } finally {
    process.env.BOOKING_TIMEZONE = saved;
    delete require.cache[modulePath];
    require('../src/utils/bookingValidation');
  }
});
