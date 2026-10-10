/**
 * Creates the unique stayKeys index on bookings, after backfilling the field.
 *
 *   npm run bookings:create-index
 *
 * This is the one script that writes. It:
 *   1. refuses to run while any two active bookings overlap on the same room,
 *   2. backfills Booking.stayKeys for every booking that is missing or stale,
 *   3. creates the unique index.
 *
 * It never deletes, cancels or re-dates a booking: cancelling a booking is an
 * operational decision, so overlaps are reported for a human to resolve. Run
 * `npm run bookings:check` for the list, fix it, then run this. Safe to run
 * repeatedly — step 2 is idempotent.
 */
const { connect, mongoose, findOverlappingBookings } = require('./bookingData');
const Booking = require('../src/models/Booking');
const { getStayKeys } = require('../src/utils/bookingAvailability');

(async () => {
  await connect();

  const overlaps = await findOverlappingBookings();
  if (overlaps.length > 0) {
    console.error(`Refusing to backfill: ${overlaps.length} overlapping active booking pair(s) exist.`);
    console.error('Run `npm run bookings:check` for the list, resolve them by hand, then try again. Nothing was changed.');
    await mongoose.disconnect();
    process.exit(2);
  }

  const bookings = await Booking.find({}).select('_id room checkInDate checkOutDate status stayKeys').lean();

  let updated = 0;
  for (const booking of bookings) {
    const expected = getStayKeys(booking.room, booking.checkInDate, booking.checkOutDate, booking.status);
    const actual = Array.isArray(booking.stayKeys) ? booking.stayKeys : [];
    const same = expected.length === actual.length && expected.every((k, i) => k === actual[i]);
    if (same) continue;

    // stayKeys has `select: false`, so a plain updateOne can still target it.
    await Booking.updateOne({ _id: booking._id }, { $set: { stayKeys: expected } });
    updated += 1;
  }
  console.log(`Backfilled stayKeys on ${updated} of ${bookings.length} booking(s).`);

  await Booking.collection.createIndex({ stayKeys: 1 }, { unique: true, name: 'booking_staykeys_unique' });
  console.log('Unique index booking_staykeys_unique is in place.');
  console.log('Two simultaneous bookings for the same room and overlapping dates can no longer both succeed.');

  await mongoose.disconnect();
})().catch(async (error) => {
  // Index build errors (e.g. E11000) contain document values, not credentials.
  console.error(`Index creation failed (${error.codeName || error.name}). Nothing was deleted.`);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});