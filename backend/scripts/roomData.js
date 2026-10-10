require('dotenv').config();

const mongoose = require('mongoose');
const Hotel = require('../src/models/Hotel');
const Room = require('../src/models/Room');
const Booking = require('../src/models/Booking');

// Shared by the three room maintenance scripts. These scripts never delete or
// rename anything; the only writes are the explicit ones named in their own
// header comments.

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

// Groups of rooms that share a room number inside one hotel (after trimming).
const findDuplicateRoomNumbers = () =>
  Room.aggregate([
    { $group: { _id: { hotel: '$hotel', roomNumber: { $trim: { input: '$roomNumber' } } }, ids: { $push: '$_id' }, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $sort: { '_id.hotel': 1, '_id.roomNumber': 1 } },
  ]);

// Hotels whose stored totalRooms differs from the real number of rooms.
const findStaleRoomCounts = async () => {
  const [hotels, counts] = await Promise.all([
    Hotel.find().select('name city totalRooms').lean(),
    Room.aggregate([{ $group: { _id: '$hotel', count: { $sum: 1 } } }]),
  ]);
  const live = new Map(counts.map((c) => [String(c._id), c.count]));
  return hotels
    .map((h) => ({ _id: h._id, name: h.name, city: h.city, stored: h.totalRooms || 0, actual: live.get(String(h._id)) || 0 }))
    .filter((h) => h.stored !== h.actual);
};

// Rooms pointing at a hotel that no longer exists.
const findRoomsWithMissingHotel = () =>
  Room.aggregate([
    { $lookup: { from: Hotel.collection.name, localField: 'hotel', foreignField: '_id', as: 'h' } },
    { $match: { h: { $size: 0 } } },
    { $project: { roomNumber: 1, hotel: 1 } },
  ]);

// Bookings whose own hotel differs from the hotel of the room they booked.
const findBookingHotelMismatches = () =>
  Booking.aggregate([
    { $lookup: { from: Room.collection.name, localField: 'room', foreignField: '_id', as: 'r' } },
    { $unwind: '$r' },
    { $match: { $expr: { $ne: ['$hotel', '$r.hotel'] } } },
    { $project: { hotel: 1, room: 1, 'r.hotel': 1 } },
  ]);

module.exports = {
  connect,
  mongoose,
  findDuplicateRoomNumbers,
  findStaleRoomCounts,
  findRoomsWithMissingHotel,
  findBookingHotelMismatches,
};
