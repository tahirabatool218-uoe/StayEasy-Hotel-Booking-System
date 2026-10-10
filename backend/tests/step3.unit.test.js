// Step 3 unit tests: room counts, room-number uniqueness, hotel reassignment
// and the dashboard metrics. Models are mocked, so no database is needed.
const test = require('node:test');
const assert = require('node:assert/strict');
const mongoose = require('mongoose');

process.env.JWT_SECRET = 'step3-unit-test-secret-step3-unit-test-secret';

const Room = require('../src/models/Room');
const Hotel = require('../src/models/Hotel');
const Booking = require('../src/models/Booking');
const Review = require('../src/models/Review');
const User = require('../src/models/User');
const rooms = require('../src/controllers/roomController');
const admin = require('../src/controllers/adminController');
const { syncHotelRoomCounts } = require('../src/utils/roomCounts');

const oid = () => new mongoose.Types.ObjectId();
const makeRes = () => {
  const res = { statusCode: 200, body: undefined };
  res.status = (code) => ((res.statusCode = code), res);
  res.json = (body) => ((res.body = body), res);
  return res;
};
const chain = (value) => ({ select: async () => value, populate: async () => value });

test('syncHotelRoomCounts writes the real count and skips duplicate/empty ids', async (t) => {
  const hotelId = oid();
  const updates = [];
  t.mock.method(Room, 'countDocuments', async () => 4);
  t.mock.method(Hotel, 'updateOne', async (...args) => updates.push(args));
  await syncHotelRoomCounts([hotelId, String(hotelId), null, undefined]);
  assert.equal(updates.length, 1);
  assert.deepEqual(updates[0][1], { $set: { totalRooms: 4 } });
  assert.deepEqual(updates[0][2], { timestamps: false });
});

test('createRoom: duplicate room number in the same hotel is a 409 and nothing is created', async (t) => {
  const hotel = oid();
  t.mock.method(Hotel, 'findById', async () => ({ _id: hotel }));
  const exists = t.mock.method(Room, 'exists', async () => ({ _id: oid() }));
  const create = t.mock.method(Room, 'create', async () => assert.fail('must not create'));
  const res = makeRes();
  await rooms.createRoom(
    { body: { hotel: String(hotel), roomNumber: ' 101 ', roomType: 'Std', description: 'd', pricePerNight: 10, capacity: 2 } },
    res
  );
  assert.equal(res.statusCode, 409);
  assert.deepEqual(exists.mock.calls[0].arguments[0], { hotel: String(hotel), roomNumber: '101' });
  assert.equal(create.mock.callCount(), 0);
});

test('createRoom: success resyncs the hotel room count', async (t) => {
  const hotel = oid();
  const synced = [];
  t.mock.method(Hotel, 'findById', async () => ({ _id: hotel }));
  t.mock.method(Room, 'exists', async () => null);
  t.mock.method(Room, 'create', async () => ({ hotel, populate: async () => {} }));
  t.mock.method(Room, 'countDocuments', async () => 7);
  t.mock.method(Hotel, 'updateOne', async (...a) => synced.push(a));
  const res = makeRes();
  await rooms.createRoom(
    { body: { hotel: String(hotel), roomNumber: '5', roomType: 'Std', description: 'd', pricePerNight: 10, capacity: 2 } },
    res
  );
  assert.equal(res.statusCode, 201);
  assert.deepEqual(synced[0][1], { $set: { totalRooms: 7 } });
});

test('createRoom: a duplicate-key error from the unique index is a 409, not a 500', async (t) => {
  const hotel = oid();
  t.mock.method(Hotel, 'findById', async () => ({ _id: hotel }));
  t.mock.method(Room, 'exists', async () => null);
  t.mock.method(Room, 'create', async () => {
    throw Object.assign(new Error('E11000 duplicate key'), { code: 11000 });
  });
  const res = makeRes();
  await rooms.createRoom(
    { body: { hotel: String(hotel), roomNumber: '5', roomType: 'Std', description: 'd', pricePerNight: 10, capacity: 2 } },
    res
  );
  assert.equal(res.statusCode, 409);
  assert.ok(!JSON.stringify(res.body).includes('E11000'));
});

test('updateRoom: moving a room that has bookings is refused (409) and nothing is updated', async (t) => {
  const roomId = oid();
  const oldHotel = oid();
  const newHotel = oid();
  t.mock.method(Hotel, 'findById', async () => ({ _id: newHotel }));
  t.mock.method(Room, 'findById', () => chain({ hotel: oldHotel, roomNumber: '9' }));
  t.mock.method(Booking, 'countDocuments', async () => 2);
  const update = t.mock.method(Room, 'findByIdAndUpdate', () => assert.fail('must not update'));
  const res = makeRes();
  await rooms.updateRoom({ params: { id: String(roomId) }, body: { hotel: String(newHotel) } }, res);
  assert.equal(res.statusCode, 409);
  assert.equal(update.mock.callCount(), 0);
});

test('updateRoom: moving an unbooked room resyncs BOTH hotels', async (t) => {
  const roomId = oid();
  const oldHotel = oid();
  const newHotel = oid();
  const synced = [];
  t.mock.method(Hotel, 'findById', async () => ({ _id: newHotel }));
  t.mock.method(Room, 'findById', () => chain({ hotel: oldHotel, roomNumber: '9' }));
  t.mock.method(Booking, 'countDocuments', async () => 0);
  t.mock.method(Room, 'exists', async () => null);
  t.mock.method(Room, 'findByIdAndUpdate', () => chain({ _id: roomId, hotel: newHotel }));
  t.mock.method(Room, 'countDocuments', async () => 1);
  t.mock.method(Hotel, 'updateOne', async (filter) => synced.push(String(filter._id)));
  const res = makeRes();
  await rooms.updateRoom({ params: { id: String(roomId) }, body: { hotel: String(newHotel) } }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(synced.sort(), [String(oldHotel), String(newHotel)].sort());
});

test('updateRoom: renaming to a number already used in the hotel is a 409', async (t) => {
  const roomId = oid();
  const hotel = oid();
  t.mock.method(Room, 'findById', () => chain({ hotel, roomNumber: '9' }));
  t.mock.method(Room, 'exists', async () => ({ _id: oid() }));
  const update = t.mock.method(Room, 'findByIdAndUpdate', () => assert.fail('must not update'));
  const res = makeRes();
  await rooms.updateRoom({ params: { id: String(roomId) }, body: { roomNumber: '10' } }, res);
  assert.equal(res.statusCode, 409);
  assert.equal(update.mock.callCount(), 0);
});

test('updateRoom: an ordinary edit (price) needs no extra lookups and no count sync', async (t) => {
  const roomId = oid();
  const findById = t.mock.method(Room, 'findById', () => assert.fail('no lookup needed'));
  const hotelUpdate = t.mock.method(Hotel, 'updateOne', async () => assert.fail('no sync needed'));
  t.mock.method(Room, 'findByIdAndUpdate', () => chain({ _id: roomId }));
  const res = makeRes();
  await rooms.updateRoom({ params: { id: String(roomId) }, body: { pricePerNight: 99 } }, res);
  assert.equal(res.statusCode, 200);
  assert.equal(findById.mock.callCount(), 0);
  assert.equal(hotelUpdate.mock.callCount(), 0);
});

test('deleteRoom: resyncs the hotel count after deleting', async (t) => {
  const roomId = oid();
  const hotel = oid();
  const synced = [];
  t.mock.method(Room, 'findById', async () => ({ _id: roomId, hotel, deleteOne: async () => {} }));
  t.mock.method(Booking, 'countDocuments', async () => 0);
  t.mock.method(Room, 'countDocuments', async () => 2);
  t.mock.method(Hotel, 'updateOne', async (...a) => synced.push(a));
  const res = makeRes();
  await rooms.deleteRoom({ params: { id: String(roomId) } }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(synced[0][1], { $set: { totalRooms: 2 } });
});

const mockDashboard = (t, { ratingRows }) => {
  t.mock.method(User, 'countDocuments', async () => 3);
  t.mock.method(Hotel, 'countDocuments', async () => 4);
  t.mock.method(Review, 'countDocuments', async () => 5);
  t.mock.method(Booking, 'aggregate', async () => [
    { _id: 'pending', count: 2 },
    { _id: 'confirmed', count: 3 },
    { _id: 'cancelled', count: 1 },
  ]);
  t.mock.method(Room, 'aggregate', async () => [
    { _id: 'available', count: 6 },
    { _id: 'maintenance', count: 1 },
  ]);
  return t.mock.method(Review, 'aggregate', async () => ratingRows);
};

test('dashboard: status counts come from grouped aggregations and totals add up', async (t) => {
  mockDashboard(t, { ratingRows: [] });
  const res = makeRes();
  await admin.getDashboardStats({}, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.totalBookings, 6);
  assert.equal(res.body.pendingBookings, 2);
  assert.equal(res.body.completedBookings, 0);
  assert.equal(res.body.totalRooms, 7);
  assert.equal(res.body.availableRooms, 6);
  assert.equal(res.body.inactiveRooms, 0);
  assert.equal(res.body.totalUsers, 3);
});

test('dashboard: no rated active hotel -> averageHotelRating is null, not 0', async (t) => {
  mockDashboard(t, { ratingRows: [] });
  const res = makeRes();
  await admin.getDashboardStats({}, res);
  assert.equal(res.body.averageHotelRating, null);
  assert.equal(res.body.ratedHotels, 0);
});

test('dashboard: average is rounded to one decimal and reports how many hotels it covers', async (t) => {
  mockDashboard(t, { ratingRows: [{ avg: 4.26, ratedHotels: 3 }] });
  const res = makeRes();
  await admin.getDashboardStats({}, res);
  assert.equal(res.body.averageHotelRating, 4.3);
  assert.equal(res.body.ratedHotels, 3);
});

test('rating metric only looks at visible reviews and active hotels', async (t) => {
  const agg = mockDashboard(t, { ratingRows: [] });
  await admin.getAverageRatedHotelRating();
  const pipeline = agg.mock.calls[0].arguments[0];
  assert.deepEqual(pipeline[0], { $match: { status: 'visible' } });
  assert.ok(pipeline.some((stage) => stage.$match && stage.$match['hotel.isActive'] === true));
});
