// Shared booking validation, used by the booking controller (user + admin
// paths) and the room availability endpoint so every entry point applies the
// same rules.
//
// Dates are *calendar dates* (a check-in day and a check-out day), not
// instants. They are parsed from "YYYY-MM-DD" and stored as midnight UTC, and
// nights are the difference in whole UTC days. Because UTC has no daylight
// saving, a stay can never be over- or under-counted by a clock change, and a
// timestamp such as "2026-03-29T23:30:00+01:00" cannot silently turn a
// one-night stay into two.

const DAY_MS = 24 * 60 * 60 * 1000;

// "Today" for the no-past-check-in rule is evaluated in one application-wide
// timezone. Hotels do not store their own timezone, so a per-hotel rule would
// need a schema change; set BOOKING_TIMEZONE (an IANA name) to match the
// market the app serves. The default matches the bundled seed data, which is
// mostly Pakistani hotels.
const DEFAULT_BOOKING_TIMEZONE = 'Asia/Karachi';

const resolveBookingTimeZone = () => {
  const timeZone = process.env.BOOKING_TIMEZONE || DEFAULT_BOOKING_TIMEZONE;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
  } catch (error) {
    // Fail loudly at startup rather than 500 on every booking later.
    throw new Error(
      `Invalid BOOKING_TIMEZONE "${timeZone}". Use an IANA timezone name such as "Asia/Karachi" or "UTC".`
    );
  }
  return timeZone;
};

const BOOKING_TIME_ZONE = resolveBookingTimeZone();

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
// The API serialises stored dates as midnight-UTC ISO strings. Accepting that
// exact form lets a value read from the API be sent back unchanged. Any other
// time-of-day is ambiguous (which calendar day did the sender mean?) and is
// rejected.
const UTC_MIDNIGHT_RE = /^(\d{4})-(\d{2})-(\d{2})T00:00:00(?:\.000)?Z$/;

// Returns a Date at midnight UTC for a real calendar date, or null. Rejects
// non-strings, other formats and impossible dates such as 2026-02-31.
const parseCalendarDate = (value) => {
  if (typeof value !== 'string') return null;

  const match = DATE_ONLY_RE.exec(value.trim()) || UTC_MIDNIGHT_RE.exec(value.trim());
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  const isRealDate =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;

  return isRealDate ? date : null;
};

const startOfUtcDay = (date) =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));

// Whole nights between two calendar days.
const calculateNights = (checkIn, checkOut) =>
  Math.round((startOfUtcDay(checkOut).getTime() - startOfUtcDay(checkIn).getTime()) / DAY_MS);

// Today's calendar date in the booking timezone, as a midnight-UTC Date so it
// compares directly with parsed check-in dates.
const getToday = (now = new Date(), timeZone = BOOKING_TIME_ZONE) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type) => Number(parts.find((p) => p.type === type).value);
  return new Date(Date.UTC(part('year'), part('month') - 1, part('day')));
};

// Returns an error message, or null when the range is acceptable.
// A stay must be at least one night. `requireFutureCheckIn` rejects a check-in
// before today (today itself is allowed).
const validateStayRange = (checkIn, checkOut, { requireFutureCheckIn = false, today = getToday() } = {}) => {
  if (checkOut.getTime() <= checkIn.getTime()) {
    return 'checkOutDate must be later than checkInDate';
  }
  if (requireFutureCheckIn && checkIn.getTime() < today.getTime()) {
    return 'checkInDate cannot be in the past';
  }
  return null;
};

// Guests must be a whole number >= 1. Accepts a JSON number or a digit string
// (query strings). Rejects booleans, arrays, floats, empty strings, NaN, etc.
// The upper bound is the room's capacity, checked separately.
const parseGuests = (value) => {
  let guests;
  if (typeof value === 'number') {
    guests = value;
  } else if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) {
    guests = Number(value.trim());
  } else {
    return { error: 'guests must be a whole number' };
  }

  if (!Number.isSafeInteger(guests)) {
    return { error: 'guests must be a whole number' };
  }
  if (guests < 1) {
    return { error: 'There must be at least 1 guest' };
  }
  return { guests };
};

// Round to cents so floating-point noise (99.99 * 3) never reaches the DB.
const calculateTotalPrice = (pricePerNight, nights) => Math.round(pricePerNight * nights * 100) / 100;

// Whether this hotel/room pair can take a (new) booking. Returns a message or
// null. Does not look at dates or capacity.
const getBookabilityError = (hotel, room) => {
  if (!hotel.isActive) {
    return 'This hotel is not currently available for booking';
  }
  if (room.hotel.toString() !== hotel._id.toString()) {
    return 'Room does not belong to the selected hotel';
  }
  if (room.status !== 'available') {
    return `Room is not available for booking (current status: ${room.status})`;
  }
  return null;
};

const getCapacityError = (room, guests) =>
  guests > room.capacity
    ? `Room capacity is ${room.capacity}; requested guests (${guests}) exceed capacity`
    : null;

module.exports = {
  BOOKING_TIME_ZONE,
  parseCalendarDate,
  startOfUtcDay,
  calculateNights,
  getToday,
  validateStayRange,
  parseGuests,
  calculateTotalPrice,
  getBookabilityError,
  getCapacityError,
};
