/**
 * Repairs Hotel.totalRooms so it equals the real number of rooms.
 *
 *   npm run rooms:sync-counts            (report what would change)
 *   npm run rooms:sync-counts -- --apply (write the corrections)
 *
 * Only the totalRooms field of hotels that are wrong is updated. No rooms,
 * bookings, reviews or other hotel fields are touched, nothing is deleted, and
 * running it twice changes nothing the second time.
 */
const { connect, mongoose, findStaleRoomCounts } = require('./roomData');
const Hotel = require('../src/models/Hotel');

(async () => {
  const apply = process.argv.includes('--apply');
  await connect();
  const stale = await findStaleRoomCounts();

  if (stale.length === 0) {
    console.log('All hotels already have the correct totalRooms. Nothing to do.');
  } else {
    stale.forEach((h) => console.log(`${apply ? 'fix ' : 'would fix'}  ${h.name} (${h.city}): ${h.stored} -> ${h.actual}`));
    if (apply) {
      await Hotel.bulkWrite(
        stale.map((h) => ({ updateOne: { filter: { _id: h._id }, update: { $set: { totalRooms: h.actual } } } })),
        { timestamps: false }
      );
      console.log(`\nUpdated ${stale.length} hotel(s).`);
    } else {
      console.log('\nDry run: nothing written. Re-run with --apply to write these corrections.');
    }
  }

  await mongoose.disconnect();
})().catch(async () => {
  console.error('Sync failed unexpectedly.');
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
