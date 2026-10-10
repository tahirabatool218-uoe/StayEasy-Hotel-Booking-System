const Booking = require('../models/Booking');
const { startOfUtcDay } = require('./bookingValidation');

const DAY_MS = 24 * 60 * 60 * 1000;

// Overlap rule: a booking blocks a requested range when
// existingCheckIn < requestedCheckOut AND existingCheckOut > requestedCheckIn.
// Cancelled bookings never block; every other status (pending, confirmed,
// completed, etc.) blocks only the dates it actually overlaps.
const getOverlapQuery = (checkIn, checkOut) => ({
  status: { $ne: 'cancelled' },
  checkInDate: { $lt: checkOut },
  checkOutDate: { $gt: checkIn },
});

// One key per night actually slept in the room, e.g.
//   '652f...c1:2026-10-12'
// A booking occupies the nights [checkIn, checkOut), so a stay from the 12th to
// the 15th claims the 12th, 13th and 14th — never the 15th, which is check-out
// day and therefore free for the next guest.
//
// These keys back a UNIQUE multikey index on Booking.stayKeys. Two bookings on
// the same room whose ranges overlap must share at least one night, so the
// second insert is rejected by the database itself. That turns "is the room
// free?" into something atomic, closing the window where the controller's
// overlap check and its insert are two separate operations (see
// bookingController.createBooking). It needs no transaction, so it works on a
// standalone MongoDB as well as a replica set.
const buildStayKeys = (roomId, checkIn, checkOut) => {
  const keys = [];
  const start = startOfUtcDay(checkIn);
  const end = startOfUtcDay(checkOut);

  // Defensive: callers validate the range first, but never loop forever if one
  // ever forgets. A negative or zero-length range claims nothing.
  if (!(start.getTime() < end.getTime())) return keys;

  for (let cursor = start; cursor.getTime() < end.getTime(); cursor = new Date(cursor.getTime() + DAY_MS)) {
    keys.push(`${roomId}:${cursor.toISOString().slice(0, 10)}`);
  }
  return keys;
};

// Cancelled bookings claim no nights (an empty array contributes no index
// entries, so it can never collide). Every other status claims its own nights,
// matching getOverlapQuery.
const getStayKeys = (roomId, checkIn, checkOut, status) =>
  status === 'cancelled' ? [] : buildStayKeys(roomId, checkIn, checkOut);

// Whether a specific room already has an active booking overlapping the
// requested date range. When an existing booking is being edited, pass its id
// as `excludeBookingId` so it does not conflict with itself.
const roomHasOverlappingBooking = async (roomId, checkIn, checkOut, { excludeBookingId } = {}) => {
  const query = {
    room: roomId,
    ...getOverlapQuery(checkIn, checkOut),
  };
  if (excludeBookingId) {
    query._id = { $ne: excludeBookingId };
  }

  const conflict = await Booking.findOne(query).select('_id');

  return !!conflict;
};

module.exports = { getOverlapQuery, roomHasOverlappingBooking, buildStayKeys, getStayKeys };
