/**
 * READ-ONLY report on room data. Changes nothing.
 *
 *   npm run rooms:check
 *
 * Reports: duplicate room numbers inside a hotel (blocks the unique index),
 * hotels whose stored totalRooms is stale, rooms whose hotel is missing, and
 * bookings whose hotel differs from their room's hotel.
 * Exit code 0 = nothing blocking, 2 = duplicates or inconsistencies found.
 */
const {
  connect,
  mongoose,
  findDuplicateRoomNumbers,
  findStaleRoomCounts,
  findRoomsWithMissingHotel,
  findBookingHotelMismatches,
} = require('./roomData');

(async () => {
  await connect();
  const [dupes, stale, orphans, mismatches] = await Promise.all([
    findDuplicateRoomNumbers(),
    findStaleRoomCounts(),
    findRoomsWithMissingHotel(),
    findBookingHotelMismatches(),
  ]);

  console.log(`Duplicate room numbers within a hotel: ${dupes.length}`);
  dupes.forEach((d) =>
    console.log(`  hotel ${d._id.hotel}  room "${d._id.roomNumber}"  x${d.count}  room ids: ${d.ids.join(', ')}`)
  );

  console.log(`\nHotels with a stale stored totalRooms: ${stale.length}`);
  stale.forEach((h) => console.log(`  ${h.name} (${h.city}): stored ${h.stored}, actual ${h.actual}`));

  console.log(`\nRooms whose hotel no longer exists: ${orphans.length}`);
  orphans.forEach((r) => console.log(`  room ${r._id} ("${r.roomNumber}") -> missing hotel ${r.hotel}`));

  console.log(`\nBookings whose hotel differs from their room's hotel: ${mismatches.length}`);
  mismatches.forEach((b) => console.log(`  booking ${b._id}: booking.hotel ${b.hotel}, room.hotel ${b.r.hotel}`));

  console.log('\nNothing was changed.');
  if (dupes.length) console.log('Resolve the duplicates by hand (rename/inactivate one room) BEFORE `npm run rooms:create-index`.');
  if (stale.length) console.log('Stale counts can be repaired with `npm run rooms:sync-counts`.');

  await mongoose.disconnect();
  process.exit(dupes.length || orphans.length || mismatches.length ? 2 : 0);
})().catch(async () => {
  console.error('Check failed unexpectedly. Nothing was changed.');
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
