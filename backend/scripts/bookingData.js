// Shared by the two booking-stay-key maintenance scripts. Like roomData.js,
// these scripts never delete or cancel anything; the only writes are the
// explicit ones named in their own header comments.
require('dotenv').config();

const mongoose = require('mongoose');
const Booking = require('../src/models/Booking');
const { getStayKeys } = require('../src/utils/bookingAvailability');

const connect = async () => {
  if (!process.env.MONGO_URI || !process.env.MONGO_URI.trim()) {
    console.error('MONGO_URI is not set (see backend/.env). Nothing was done.');
    process.exit(1);
  }
  try {
    await mongoose.connect(process.env.MONGO_URI);
  } catch (error) {
    // Do not print error.message: it can echo the connection string.
    console.error('Could not connect to MongoDB. Check MONGO_URI. Nothing was done.');
    process.exit(1);
  }
};

const stayKeyProjection = { _id: 1, room: 1, checkInDate: 1, checkOutDate: 1, status: 1 };

// Non-cancelled bookings whose date ranges overlap on the same room. These are
// the records that would collide when the unique stayKeys index is built, since
// each pair must share at least one night.
const findOverlappingBookings = () =>
  Booking.aggregate([
    { $match: { status: { $ne: 'cancelled' } } },
    { $sort: { room: 1, checkInDate: 1 } },
    {
      $lookup: {
        from: Booking.collection.name,
        let: { room: '$room', checkIn: '$checkInDate', checkOut: '$checkOutDate', id: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ['$room', '$$room'] },
                  { $ne: ['$_id', '$$id'] },
                  { $ne: ['$status', 'cancelled'] },
                  { $lt: ['$checkInDate', '$$checkOut'] },
                  { $gt: ['$checkOutDate', '$$checkIn'] },
                ],
              },
            },
          },
          { $project: stayKeyProjection },
          { $limit: 5 },
        ],
        as: 'overlaps',
      },
    },
    { $match: { 'overlaps.0': { $exists: true } } },
    { $project: { ...stayKeyProjection, overlaps: 1 } },
  ]);

// Bookings whose stored stayKeys do not match what the current room, dates and
// status imply. Legacy documents written before this field existed have none.
const findStaleStayKeys = async () => {
  const bookings = await Booking.find({}).select(stayKeyProjection).select('+stayKeys').lean();
  return bookings
    .map((b) => {
      const expected = getStayKeys(b.room, b.checkInDate, b.checkOutDate, b.status);
      const actual = Array.isArray(b.stayKeys) ? b.stayKeys : [];
      const same = expected.length === actual.length && expected.every((k, i) => k === actual[i]);
      return same ? null : { _id: b._id, status: b.status, expected: expected.length, actual: actual.length };
    })
    .filter(Boolean);
};

module.exports = { connect, mongoose, findOverlappingBookings, findStaleStayKeys };