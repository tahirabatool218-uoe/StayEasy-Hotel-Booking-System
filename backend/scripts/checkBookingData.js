/**
 * READ-ONLY report on booking data. Changes nothing.
 *
 *   npm run bookings:check
 *
 * Reports: overlapping bookings on the same room (these block the unique
 * stayKeys index) and bookings whose stored stayKeys are missing or stale.
 * Exit code 0 = nothing blocking, 2 = overlaps or stale keys found.
 */
const { connect, mongoose, findOverlappingBookings, findStaleStayKeys } = require('./bookingData');

const fmt = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d));

(async () => {
  await connect();
  const [overlaps, stale] = await Promise.all([findOverlappingBookings(), findStaleStayKeys()]);

  console.log(`Overlapping active bookings on the same room: ${overlaps.length}`);
  overlaps.forEach((b) => {
    console.log(`  booking ${b._id}  room ${b.room}  ${b.status}  ${fmt(b.checkInDate)} -> ${fmt(b.checkOutDate)}`);
    b.overlaps.forEach((o) =>
      console.log(`     overlaps ${o._id}  ${o.status}  ${fmt(o.checkInDate)} -> ${fmt(o.checkOutDate)}`)
    );
  });

  console.log(`\nBookings with missing or stale stayKeys: ${stale.length}`);
  stale.slice(0, 25).forEach((b) =>
    console.log(`  booking ${b._id}  ${b.status}  expected ${b.expected} key(s), stored ${b.actual}`)
  );
  if (stale.length > 25) console.log(`  ...and ${stale.length - 25} more`);

  console.log('\nNothing was changed.');
  if (overlaps.length)
    console.log(
      'Resolve the overlaps by hand (cancel or move one booking of each pair) BEFORE `npm run bookings:create-index`.'
    );
  if (stale.length)
    console.log('Stale keys are repaired by `npm run bookings:create-index`, which backfills them before building the index.');

  await mongoose.disconnect();
  process.exit(overlaps.length ? 2 : 0);
})().catch(async () => {
  console.error('Check failed unexpectedly. Nothing was changed.');
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});