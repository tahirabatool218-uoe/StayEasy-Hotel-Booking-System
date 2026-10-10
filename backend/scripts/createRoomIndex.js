/**
 * Creates the unique {hotel, roomNumber} index on rooms.
 *
 *   npm run rooms:create-index
 *
 * Refuses to run (and changes nothing) while duplicate room numbers exist in
 * any hotel: it never deletes or renames rooms. Run `npm run rooms:check`,
 * fix the listed duplicates by hand, then run this. Safe to run repeatedly.
 */
const { connect, mongoose, findDuplicateRoomNumbers } = require('./roomData');
const Room = require('../src/models/Room');

(async () => {
  await connect();
  const dupes = await findDuplicateRoomNumbers();

  if (dupes.length > 0) {
    console.error(`Refusing to create the unique index: ${dupes.length} duplicate room number group(s) exist.`);
    console.error('Run `npm run rooms:check` for the list, resolve them by hand, then try again. Nothing was changed.');
    await mongoose.disconnect();
    process.exit(2);
  }

  await Room.collection.createIndex({ hotel: 1, roomNumber: 1 }, { unique: true, name: 'hotel_1_roomNumber_1_unique' });
  console.log('Unique index hotel_1_roomNumber_1_unique is in place.');
  await mongoose.disconnect();
})().catch(async (error) => {
  // Index build errors (e.g. E11000) contain document values, not credentials.
  console.error(`Index creation failed (${error.codeName || error.name}). Nothing was deleted.`);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
