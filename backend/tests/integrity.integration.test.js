// Integration tests for the Step 1 data-integrity fixes.
//
// Spawns the real server (server.js, unmodified) against a throwaway database
// and drives it over HTTP. Needs a MongoDB-compatible server:
//
//   TEST_MONGO_URI=mongodb://127.0.0.1:27017 npm test
//
// Without TEST_MONGO_URI these tests are skipped (the unit tests still run).
// A uniquely named database is created and dropped; nothing else is touched.
// Never point TEST_MONGO_URI at a database you care about.
const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const path = require('node:path');

const TEST_MONGO_URI = process.env.TEST_MONGO_URI;
const skip = TEST_MONGO_URI ? false : 'TEST_MONGO_URI is not set';

process.env.JWT_SECRET = 'integration-test-secret';
process.env.BOOKING_TIMEZONE = 'UTC';

describe('Step 1 integrity fixes (HTTP)', { skip }, () => {
  let mongoose, models, generateToken, getToday;
  let server, baseUrl, dbName;
  let admin, user, user2, adminToken, userToken, user2Token;

  // ---------- helpers ----------
  const dayStr = (offset) => {
    const d = new Date(getToday().getTime() + offset * 86400000);
    return d.toISOString().slice(0, 10);
  };
  const dayDate = (offset) => new Date(`${dayStr(offset)}T00:00:00.000Z`);

  const call = async (method, url, { token, body } = {}) => {
    const res = await fetch(`${baseUrl}${url}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    let data = null;
    try {
      data = await res.json();
    } catch (e) {
      /* empty body */
    }
    return { status: res.status, data };
  };

  const expectStatus = (res, status) =>
    assert.equal(res.status, status, `expected ${status}, got ${res.status}: ${JSON.stringify(res.data)}`);

  let seq = 0;
  const makeHotel = (overrides = {}) =>
    models.Hotel.create({
      name: `Test Hotel ${++seq}`,
      description: 'd',
      location: 'l',
      city: 'Lahore',
      country: 'Pakistan',
      address: 'a',
      pricePerNight: 100,
      rating: 3.5,
      totalRooms: 7,
      ...overrides,
    });
  const makeRoom = (hotel, overrides = {}) =>
    models.Room.create({
      hotel: hotel._id,
      roomNumber: `R${++seq}`,
      roomType: 'Standard',
      description: 'd',
      pricePerNight: 100,
      capacity: 2,
      ...overrides,
    });
  // Direct insert, bypassing the API: used to create "legacy" states the API
  // itself would now refuse (past dates, overlapping bookings).
  const makeBooking = (hotel, room, inDay, outDay, overrides = {}) =>
    models.Booking.create({
      user: user._id,
      hotel: hotel._id,
      room: room._id,
      checkInDate: dayDate(inDay),
      checkOutDate: dayDate(outDay),
      guests: 1,
      totalPrice: 100 * (outDay - inDay),
      ...overrides,
    });
  const bookViaApi = (hotel, room, inDay, outDay, extra = {}, token = userToken) =>
    call('POST', '/api/bookings', {
      token,
      body: { hotel: hotel._id, room: room._id, checkInDate: dayStr(inDay), checkOutDate: dayStr(outDay), guests: 1, ...extra },
    });

  // ---------- lifecycle ----------
  before(async () => {
    mongoose = require('mongoose');
    models = {
      User: require('../src/models/User'),
      Hotel: require('../src/models/Hotel'),
      Room: require('../src/models/Room'),
      Booking: require('../src/models/Booking'),
      Review: require('../src/models/Review'),
    };
    generateToken = require('../src/utils/generateToken');
    ({ getToday } = require('../src/utils/bookingValidation'));

    dbName = `stayeasy_test_${process.pid}_${Date.now()}`;
    const uri = `${TEST_MONGO_URI.replace(/\/$/, '')}/${dbName}`;
    await mongoose.connect(uri);

    admin = await models.User.create({ name: 'Admin', email: 'admin@test.dev', password: 'secret12', role: 'admin' });
    user = await models.User.create({ name: 'User', email: 'user@test.dev', password: 'secret12' });
    user2 = await models.User.create({ name: 'User Two', email: 'user2@test.dev', password: 'secret12' });
    adminToken = generateToken(admin._id);
    userToken = generateToken(user._id);
    user2Token = generateToken(user2._id);

    const port = 20000 + Math.floor(Math.random() * 20000);
    baseUrl = `http://127.0.0.1:${port}`;
    server = spawn(process.execPath, ['server.js'], {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, PORT: String(port), MONGO_URI: uri, JWT_SECRET: 'integration-test-secret', BOOKING_TIMEZONE: 'UTC', API_RATE_LIMIT_MAX: '100000' },
      stdio: 'ignore',
    });

    for (let i = 0; i < 50; i += 1) {
      try {
        const res = await fetch(`${baseUrl}/`);
        if (res.ok) return;
      } catch (e) {
        /* not up yet */
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    throw new Error('test server did not start');
  });

  after(async () => {
    if (server) server.kill();
    if (mongoose && mongoose.connection.readyState === 1) {
      await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    }
  });

  // =====================================================================
  describe('Task 1 — ratings and totalRooms', () => {
    it('create ignores client-supplied rating/totalRooms', async () => {
      const res = await call('POST', '/api/hotels', {
        token: adminToken,
        body: {
          name: 'New', description: 'd', location: 'l', city: 'c', country: 'x', address: 'a',
          pricePerNight: 50, rating: 5, totalRooms: 999,
        },
      });
      expectStatus(res, 201);
      assert.equal(res.data.rating, 0);
      assert.equal(res.data.totalRooms, 0);
    });

    it('update ignores rating/totalRooms but still applies ordinary edits', async () => {
      const hotel = await makeHotel();
      const res = await call('PUT', `/api/hotels/${hotel._id}`, {
        token: adminToken,
        body: { name: 'Renamed', pricePerNight: 120, rating: 1, totalRooms: 123 },
      });
      expectStatus(res, 200);
      const fresh = await models.Hotel.findById(hotel._id);
      assert.equal(fresh.name, 'Renamed');
      assert.equal(fresh.pricePerNight, 120);
      assert.equal(fresh.rating, 3.5, 'rating must be untouched');
      assert.equal(fresh.totalRooms, 7, 'totalRooms must be untouched');
    });

    it('a PUT carrying only rating changes nothing and does not error', async () => {
      const hotel = await makeHotel();
      const res = await call('PUT', `/api/hotels/${hotel._id}`, { token: adminToken, body: { rating: 5 } });
      expectStatus(res, 200);
      assert.equal((await models.Hotel.findById(hotel._id)).rating, 3.5);
    });

    it('an admin edit never resets a review-derived rating (rating set directly in the DB)', async () => {
      const hotel = await makeHotel({ rating: 4.2 });
      expectStatus(await call('PUT', `/api/hotels/${hotel._id}`, { token: adminToken, body: { name: 'Edited', city: 'Karachi', rating: 0 } }), 200);
      const fresh = await models.Hotel.findById(hotel._id);
      assert.equal(fresh.rating, 4.2);
      assert.equal(fresh.city, 'Karachi');
    });

    it('review-based recalculation still works and survives admin edits', async (t) => {
      // recalculateHotelRating (unchanged by Step 1) uses an $avg aggregation.
      // Some MongoDB-compatible servers (e.g. FerretDB 1.x) do not implement
      // it; skip rather than report a false failure there. Real MongoDB does.
      try {
        await models.Review.aggregate([{ $group: { _id: null, a: { $avg: '$rating' } } }]);
      } catch (error) {
        return t.skip(`database does not support $avg: ${error.message}`);
      }
      const hotel = await makeHotel({ rating: 0 });
      const room = await makeRoom(hotel);
      const booking = await makeBooking(hotel, room, -10, -8, { status: 'completed' });

      const review = await call('POST', '/api/reviews', {
        token: userToken,
        body: { hotel: hotel._id, booking: booking._id, rating: 4, comment: 'Nice' },
      });
      expectStatus(review, 201);
      assert.equal((await models.Hotel.findById(hotel._id)).rating, 4);

      expectStatus(await call('PUT', `/api/hotels/${hotel._id}`, { token: adminToken, body: { name: 'Edited', rating: 1 } }), 200);
      assert.equal((await models.Hotel.findById(hotel._id)).rating, 4, 'admin edit must not reset the derived rating');

      // hiding the review (admin) recalculates from visible reviews only
      expectStatus(await call('PUT', `/api/reviews/${review.data._id}`, { token: adminToken, body: { status: 'hidden' } }), 200);
      assert.equal((await models.Hotel.findById(hotel._id)).rating, 0);
    });
  });

  // =====================================================================
  describe('Task 2 — deletion protection', () => {
    it('refuses to delete a room that has any booking (even cancelled) with 409, keeping history', async () => {
      const hotel = await makeHotel();
      const room = await makeRoom(hotel);
      const booking = await makeBooking(hotel, room, -30, -28, { status: 'cancelled' });

      const res = await call('DELETE', `/api/rooms/${room._id}`, { token: adminToken });
      expectStatus(res, 409);
      assert.match(res.data.message, /booking/);
      assert.match(res.data.message, /inactive/);
      assert.ok(await models.Room.findById(room._id));
      assert.ok(await models.Booking.findById(booking._id));
    });

    it('still deletes a room with no bookings', async () => {
      const hotel = await makeHotel();
      const room = await makeRoom(hotel);
      expectStatus(await call('DELETE', `/api/rooms/${room._id}`, { token: adminToken }), 200);
      assert.equal(await models.Room.findById(room._id), null);
    });

    it('refuses to delete a hotel that has bookings, without touching bookings or reviews', async () => {
      const hotel = await makeHotel();
      const room = await makeRoom(hotel);
      const booking = await makeBooking(hotel, room, -20, -18, { status: 'completed' });
      await models.Review.create({ user: user._id, hotel: hotel._id, booking: booking._id, rating: 5, comment: 'x' });

      const res = await call('DELETE', `/api/hotels/${hotel._id}`, { token: adminToken });
      expectStatus(res, 409);
      assert.match(res.data.message, /1 booking/);
      assert.match(res.data.message, /1 review/);
      assert.ok(await models.Hotel.findById(hotel._id));
      assert.ok(await models.Room.findById(room._id));
      assert.ok(await models.Booking.findById(booking._id));
      assert.equal(await models.Review.countDocuments({ hotel: hotel._id }), 1);
    });

    it('refuses to delete a hotel that still has rooms (never cascades rooms)', async () => {
      const hotel = await makeHotel();
      const room = await makeRoom(hotel);
      const res = await call('DELETE', `/api/hotels/${hotel._id}`, { token: adminToken });
      expectStatus(res, 409);
      assert.match(res.data.message, /room/);
      assert.ok(await models.Room.findById(room._id));
    });

    it('deletes an empty hotel; unknown IDs are 404; non-admins are blocked', async () => {
      const hotel = await makeHotel();
      expectStatus(await call('DELETE', `/api/hotels/${hotel._id}`, { token: userToken }), 403);
      expectStatus(await call('DELETE', `/api/hotels/${hotel._id}`), 401);
      expectStatus(await call('DELETE', `/api/hotels/${hotel._id}`, { token: adminToken }), 200);
      assert.equal(await models.Hotel.findById(hotel._id), null);
      expectStatus(await call('DELETE', `/api/hotels/${hotel._id}`, { token: adminToken }), 404);
      expectStatus(await call('DELETE', `/api/rooms/${new mongoose.Types.ObjectId()}`, { token: adminToken }), 404);
    });

    it('refuses to move a room with bookings to another hotel, but allows a same-hotel edit and moving an unbooked room', async () => {
      const hotelA = await makeHotel();
      const hotelB = await makeHotel();
      const bookedRoom = await makeRoom(hotelA);
      await makeBooking(hotelA, bookedRoom, 5, 6);

      const move = await call('PUT', `/api/rooms/${bookedRoom._id}`, { token: adminToken, body: { hotel: hotelB._id } });
      expectStatus(move, 409);
      assert.equal((await models.Room.findById(bookedRoom._id)).hotel.toString(), hotelA._id.toString());

      // the admin form always re-sends the current hotel: must keep working
      const same = await call('PUT', `/api/rooms/${bookedRoom._id}`, {
        token: adminToken,
        body: { hotel: hotelA._id, pricePerNight: 111, status: 'inactive' },
      });
      expectStatus(same, 200);
      assert.equal(same.data.pricePerNight, 111);
      assert.equal(same.data.status, 'inactive');

      const freeRoom = await makeRoom(hotelA);
      expectStatus(await call('PUT', `/api/rooms/${freeRoom._id}`, { token: adminToken, body: { hotel: hotelB._id } }), 200);
    });
  });

  // =====================================================================
  describe('Task 3 — inactive hotels', () => {
    let hidden, hiddenRoom, shown, shownRoom;
    before(async () => {
      hidden = await makeHotel({ isActive: false });
      hiddenRoom = await makeRoom(hidden);
      shown = await makeHotel();
      shownRoom = await makeRoom(shown);
    });

    it('GET /hotels/:id is 404 for the public and users, 200 for admins', async () => {
      expectStatus(await call('GET', `/api/hotels/${hidden._id}`), 404);
      expectStatus(await call('GET', `/api/hotels/${hidden._id}`, { token: userToken }), 404);
      const adminRes = await call('GET', `/api/hotels/${hidden._id}`, { token: adminToken });
      expectStatus(adminRes, 200);
      assert.equal(adminRes.data.isActive, false);
    });

    it('public browsing of active hotels keeps working, with or without a (bad) token', async () => {
      expectStatus(await call('GET', `/api/hotels/${shown._id}`), 200);
      expectStatus(await call('GET', `/api/hotels/${shown._id}`, { token: userToken }), 200);
      // a bad token on a public route must NOT 401 (the frontend would log the visitor out)
      expectStatus(await call('GET', `/api/hotels/${shown._id}`, { token: 'garbage.token.value' }), 200);
      const list = await call('GET', '/api/hotels?limit=100');
      expectStatus(list, 200);
      const ids = list.data.hotels.map((h) => h._id);
      assert.ok(ids.includes(shown._id.toString()));
      assert.ok(!ids.includes(hidden._id.toString()));
    });

    it('GET /rooms hides rooms of inactive hotels from the public; admins still see them', async () => {
      const anon = await call('GET', '/api/rooms');
      expectStatus(anon, 200);
      const anonIds = anon.data.map((r) => r._id);
      assert.ok(anonIds.includes(shownRoom._id.toString()));
      assert.ok(!anonIds.includes(hiddenRoom._id.toString()));

      const byHotel = await call('GET', `/api/rooms?hotel=${hidden._id}`);
      expectStatus(byHotel, 200);
      assert.deepEqual(byHotel.data, []);
      assert.equal((await call('GET', `/api/rooms?hotel=${shown._id}`)).data.length, 1);

      const adminAll = await call('GET', '/api/rooms', { token: adminToken });
      assert.ok(adminAll.data.map((r) => r._id).includes(hiddenRoom._id.toString()));
      assert.equal((await call('GET', `/api/rooms?hotel=${hidden._id}`, { token: adminToken })).data.length, 1);
    });

    it('rooms of a deleted/missing hotel are not exposed to the public', async () => {
      const orphan = await models.Room.create({
        hotel: new mongoose.Types.ObjectId(), roomNumber: 'ORPHAN', roomType: 'x', description: 'd', pricePerNight: 1, capacity: 1,
      });
      const anon = await call('GET', '/api/rooms');
      assert.ok(!anon.data.map((r) => r._id).includes(orphan._id.toString()));
      expectStatus(await call('GET', `/api/rooms/${orphan._id}`), 404);
    });

    it('GET /rooms/:id is 404 for a room of an inactive hotel unless admin', async () => {
      expectStatus(await call('GET', `/api/rooms/${hiddenRoom._id}`), 404);
      expectStatus(await call('GET', `/api/rooms/${hiddenRoom._id}`, { token: userToken }), 404);
      expectStatus(await call('GET', `/api/rooms/${hiddenRoom._id}`, { token: adminToken }), 200);
      const ok = await call('GET', `/api/rooms/${shownRoom._id}`);
      expectStatus(ok, 200);
      assert.equal(ok.data.hotel.name, shown.name, 'response shape (populated hotel) unchanged');
    });

    it('availability search treats an inactive hotel as not found', async () => {
      const q = (id) => `/api/rooms/availability?hotel=${id}&checkInDate=${dayStr(3)}&checkOutDate=${dayStr(5)}&guests=1`;
      expectStatus(await call('GET', q(hidden._id)), 404);
      const ok = await call('GET', q(shown._id));
      expectStatus(ok, 200);
      assert.equal(ok.data.length, 1);
    });

    it('cannot book a room of an inactive hotel via the API, and nothing is created', async () => {
      const before = await models.Booking.countDocuments({ hotel: hidden._id });
      const res = await bookViaApi(hidden, hiddenRoom, 3, 5);
      expectStatus(res, 400);
      assert.match(res.data.message, /not currently available/);
      expectStatus(await bookViaApi(hidden, hiddenRoom, 3, 5, {}, adminToken), 400); // admins cannot book it either
      assert.equal(await models.Booking.countDocuments({ hotel: hidden._id }), before);
    });

    it('re-activating the hotel makes it bookable again', async () => {
      const hotel = await makeHotel({ isActive: false });
      const room = await makeRoom(hotel);
      expectStatus(await bookViaApi(hotel, room, 3, 5), 400);
      expectStatus(await call('PUT', `/api/hotels/${hotel._id}`, { token: adminToken, body: { isActive: true } }), 200);
      expectStatus(await bookViaApi(hotel, room, 3, 5), 201);
    });
  });

  // =====================================================================
  describe('Task 4 — booking input validation (create)', () => {
    let hotel, room;
    before(async () => {
      hotel = await makeHotel();
      room = await makeRoom(hotel, { pricePerNight: 99.99, capacity: 3 });
    });

    it('creates a booking, derives price from calendar nights, ignores client totalPrice, stores midnight-UTC dates', async () => {
      const res = await bookViaApi(hotel, room, 40, 43, { totalPrice: 1, guests: 2 });
      expectStatus(res, 201);
      assert.equal(res.data.totalPrice, 299.97);
      assert.equal(res.data.guests, 2);
      assert.equal(res.data.checkInDate, `${dayStr(40)}T00:00:00.000Z`);
      assert.equal(res.data.checkOutDate, `${dayStr(43)}T00:00:00.000Z`);
      assert.equal(res.data.status, 'pending');
    });

    it('allows check-in today', async () => {
      const own = await makeRoom(hotel);
      expectStatus(await bookViaApi(hotel, own, 0, 1), 201);
    });

    it('rejects invalid dates', async () => {
      const cases = [
        [dayStr(50), dayStr(50)], // same day
        [dayStr(52), dayStr(50)], // reversed
        [dayStr(-1), dayStr(2)], // past check-in
        ['2026-02-31', '2026-03-02'], // impossible date
        ['not-a-date', dayStr(5)],
        [`${dayStr(50)}T10:30:00+05:00`, `${dayStr(52)}T10:30:00+05:00`], // ambiguous timestamps
        [20260101, 20260105], // numbers
        [[dayStr(50)], dayStr(52)],
      ];
      for (const [i, o] of cases) {
        const res = await call('POST', '/api/bookings', {
          token: userToken,
          body: { hotel: hotel._id, room: room._id, checkInDate: i, checkOutDate: o, guests: 1 },
        });
        expectStatus(res, 400);
      }
      assert.equal(await models.Booking.countDocuments({ room: room._id }), 1, 'only the valid booking exists');
    });

    it('rejects invalid, non-integer, zero, negative and excessive guest counts', async () => {
      for (const guests of [0, -1, 1.5, '1.5', 'abc', true, null, [], {}, 99, 4]) {
        const res = await bookViaApi(hotel, room, 60, 62, { guests });
        expectStatus(res, 400);
      }
      const over = await bookViaApi(hotel, room, 60, 62, { guests: 4 });
      assert.match(over.data.message, /capacity is 3/);
    });

    it('rejects malformed IDs, unknown IDs and a room from another hotel', async () => {
      const other = await makeHotel();
      const otherRoom = await makeRoom(other);
      expectStatus(await call('POST', '/api/bookings', { token: userToken, body: { hotel: 'nope', room: room._id, checkInDate: dayStr(60), checkOutDate: dayStr(62), guests: 1 } }), 400);
      expectStatus(await call('POST', '/api/bookings', { token: userToken, body: { hotel: { $ne: null }, room: room._id, checkInDate: dayStr(60), checkOutDate: dayStr(62), guests: 1 } }), 400);
      expectStatus(await call('POST', '/api/bookings', { token: userToken, body: { hotel: new mongoose.Types.ObjectId(), room: room._id, checkInDate: dayStr(60), checkOutDate: dayStr(62), guests: 1 } }), 404);
      const mismatch = await bookViaApi(hotel, otherRoom, 60, 62);
      expectStatus(mismatch, 400);
      assert.match(mismatch.data.message, /does not belong/);
    });

    it('rejects rooms that are not available, and requires authentication', async () => {
      const maint = await makeRoom(hotel, { status: 'maintenance' });
      expectStatus(await bookViaApi(hotel, maint, 60, 62), 400);
      expectStatus(await call('POST', '/api/bookings', { body: {} }), 401);
    });
  });

  // =====================================================================
  describe('Task 5 — overlap rules (create)', () => {
    it('blocks overlapping ranges but allows back-to-back stays; cancelled bookings never block', async () => {
      const hotel = await makeHotel();
      const room = await makeRoom(hotel);

      const first = await bookViaApi(hotel, room, 10, 13);
      expectStatus(first, 201);

      for (const [i, o] of [[10, 13], [11, 12], [9, 11], [12, 15], [8, 20]]) {
        expectStatus(await bookViaApi(hotel, room, i, o, {}, user2Token), 409);
      }
      expectStatus(await bookViaApi(hotel, room, 13, 15, {}, user2Token), 201); // check-in == existing check-out
      expectStatus(await bookViaApi(hotel, room, 8, 10, {}, user2Token), 201); // check-out == existing check-in

      expectStatus(await call('PUT', `/api/bookings/${first.data._id}`, { token: userToken, body: { status: 'cancelled' } }), 200);
      expectStatus(await bookViaApi(hotel, room, 10, 13, {}, user2Token), 201);
    });
  });

  // =====================================================================
  describe('Task 4/5 — admin booking updates', () => {
    let hotel, room;
    const put = (id, body, token = adminToken) => call('PUT', `/api/bookings/${id}`, { token, body });

    before(async () => {
      hotel = await makeHotel();
      room = await makeRoom(hotel, { pricePerNight: 50, capacity: 2 });
    });

    it('a booking does not conflict with itself; price is recomputed from calendar nights', async () => {
      const b = await makeBooking(hotel, room, 100, 103);
      const res = await put(b._id, { checkInDate: dayStr(101) }); // moves inside its own old range
      expectStatus(res, 200);
      assert.equal(res.data.totalPrice, 100); // 2 nights * 50
      assert.equal(res.data.checkInDate, `${dayStr(101)}T00:00:00.000Z`);
    });

    it('ignores client totalPrice and room/hotel/user changes', async () => {
      const other = await makeRoom(hotel);
      const b = await makeBooking(hotel, room, 110, 112, { totalPrice: 100 });
      const res = await put(b._id, { totalPrice: 1, room: other._id, hotel: new mongoose.Types.ObjectId(), user: user2._id, status: 'confirmed' });
      expectStatus(res, 200);
      const fresh = await models.Booking.findById(b._id);
      assert.equal(fresh.totalPrice, 100);
      assert.equal(fresh.room.toString(), room._id.toString());
      assert.equal(fresh.user.toString(), user._id.toString());
      assert.equal(fresh.status, 'confirmed');
    });

    it('rejects invalid statuses, dates and guests', async () => {
      const b = await makeBooking(hotel, room, 120, 122);
      for (const body of [
        { status: 'bogus' }, { status: null }, { status: '' },
        { checkInDate: 'garbage' }, { checkOutDate: dayStr(119) }, { checkOutDate: dayStr(120) },
        { checkInDate: dayStr(122) }, { checkInDate: '2026-02-31' },
        { guests: 0 }, { guests: -2 }, { guests: 1.5 }, { guests: 'abc' }, { guests: 3 },
      ]) {
        expectStatus(await put(b._id, body), 400);
      }
      const fresh = await models.Booking.findById(b._id);
      assert.equal(fresh.guests, 1);
      assert.equal(fresh.status, 'pending');
    });

    it('rejects moving a live booking to a past check-in; allows extending a stay in progress and correcting a completed booking', async () => {
      const live = await makeBooking(hotel, room, 130, 132);
      const past = await put(live._id, { checkInDate: dayStr(-3) });
      expectStatus(past, 400);
      assert.match(past.data.message, /past/);

      const ongoing = await makeBooking(hotel, await makeRoom(hotel, { pricePerNight: 50 }), -1, 1, { status: 'confirmed' });
      const extended = await put(ongoing._id, { checkOutDate: dayStr(2) });
      expectStatus(extended, 200);
      assert.equal(extended.data.totalPrice, 150); // 3 nights

      const done = await makeBooking(hotel, await makeRoom(hotel), -20, -18, { status: 'completed' });
      expectStatus(await put(done._id, { checkInDate: dayStr(-21) }), 200);
    });

    it('rejects date changes that overlap another booking (409) and leaves the booking unchanged', async () => {
      const r = await makeRoom(hotel, { pricePerNight: 50 });
      const a = await makeBooking(hotel, r, 140, 142);
      await makeBooking(hotel, r, 145, 148, { user: user2._id });

      const res = await put(a._id, { checkOutDate: dayStr(146) });
      expectStatus(res, 409);
      assert.equal((await models.Booking.findById(a._id)).checkOutDate.toISOString(), `${dayStr(142)}T00:00:00.000Z`);

      expectStatus(await put(a._id, { checkOutDate: dayStr(145) }), 200); // touching is fine
    });

    it('rejects reactivating a cancelled booking that now conflicts, leaving it cancelled', async () => {
      const r = await makeRoom(hotel);
      const cancelled = await makeBooking(hotel, r, 150, 153, { status: 'cancelled' });
      await makeBooking(hotel, r, 151, 152, { user: user2._id }); // someone else took the dates

      for (const status of ['pending', 'confirmed', 'completed']) {
        expectStatus(await put(cancelled._id, { status }), 409);
      }
      assert.equal((await models.Booking.findById(cancelled._id)).status, 'cancelled');
    });

    it('allows reactivating when there is no conflict', async () => {
      const r = await makeRoom(hotel);
      const cancelled = await makeBooking(hotel, r, 160, 162, { status: 'cancelled' });
      expectStatus(await put(cancelled._id, { status: 'confirmed' }), 200);
    });

    it('rejects confirming a pending booking that conflicts with another valid booking (legacy double-booking), but cancelling it still works', async () => {
      const r = await makeRoom(hotel);
      await makeBooking(hotel, r, 170, 173, { status: 'confirmed', user: user2._id });
      const legacy = await makeBooking(hotel, r, 171, 174); // pending, overlapping: only possible via legacy data/race

      expectStatus(await put(legacy._id, { status: 'confirmed' }), 409);
      expectStatus(await put(legacy._id, { status: 'cancelled' }), 200);
    });

    it('blocks reactivating into an unbookable room or hidden hotel, and guest changes above capacity', async () => {
      const maintRoom = await makeRoom(hotel, { status: 'maintenance' });
      const c1 = await makeBooking(hotel, maintRoom, 180, 182, { status: 'cancelled' });
      const r1 = await put(c1._id, { status: 'confirmed' });
      expectStatus(r1, 409);
      assert.match(r1.data.message, /maintenance/);

      const hiddenHotel = await makeHotel({ isActive: false });
      const hiddenRoom = await makeRoom(hiddenHotel);
      const c2 = await makeBooking(hiddenHotel, hiddenRoom, 180, 182, { status: 'cancelled' });
      expectStatus(await put(c2._id, { status: 'pending' }), 409);

      const smallRoom = await makeRoom(hotel, { capacity: 2 });
      const b = await makeBooking(hotel, smallRoom, 190, 192);
      expectStatus(await put(b._id, { guests: 3 }), 400);
      expectStatus(await put(b._id, { guests: 2 }), 200);
    });

    it('plain status moves (e.g. pending -> completed) and cancel still work; users keep cancel-only rights', async () => {
      const r = await makeRoom(hotel);
      const b = await makeBooking(hotel, r, 200, 202);
      expectStatus(await put(b._id, { status: 'completed' }), 200);

      const mine = await makeBooking(hotel, await makeRoom(hotel), 210, 212);
      expectStatus(await put(mine._id, { checkInDate: dayStr(211) }, userToken), 400); // users cannot edit dates
      expectStatus(await put(mine._id, { status: 'cancelled' }, user2Token), 403);
      expectStatus(await put(mine._id, { status: 'cancelled' }, userToken), 200);
    });
  });
});
