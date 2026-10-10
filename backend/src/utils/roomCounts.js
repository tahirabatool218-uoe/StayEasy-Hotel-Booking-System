const Room = require('../models/Room');
const Hotel = require('../models/Hotel');

// `Hotel.totalRooms` is a stored copy of "how many rooms belong to this hotel".
// It is never taken from a client (see hotelController); it is recomputed from
// the rooms collection whenever a room is created, deleted or moved, so the
// stored copy cannot drift. One count + one update per affected hotel.
//
// `timestamps: false` keeps the hotel's updatedAt meaning "an admin edited it".
const syncHotelRoomCount = async (hotelId) => {
  if (!hotelId) return null;
  const count = await Room.countDocuments({ hotel: hotelId });
  await Hotel.updateOne({ _id: hotelId }, { $set: { totalRooms: count } }, { timestamps: false });
  return count;
};

// Sync several hotels (e.g. old and new hotel of a moved room), skipping
// duplicates and empty values.
const syncHotelRoomCounts = async (hotelIds) => {
  const unique = [...new Set(hotelIds.filter(Boolean).map(String))];
  for (const id of unique) {
    // eslint-disable-next-line no-await-in-loop
    await syncHotelRoomCount(id);
  }
};

module.exports = { syncHotelRoomCount, syncHotelRoomCounts };
