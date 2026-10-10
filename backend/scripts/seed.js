require('dotenv').config();

const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const Hotel = require('../src/models/Hotel');
const Room = require('../src/models/Room');
const User = require('../src/models/User');
const { buildSeedUsers, resolveSeedPasswords, describeSeedUsers, redact, SeedConfigError } = require('./seedCredentials');

/**
 * StayEasy sample-data seeder.
 *
 * Non-destructive by design: it only INSERTs documents that are not already
 * present. It never updates, overwrites or deletes anything, so it is safe to
 * run against a database that already holds real data. It is also idempotent —
 * a second run reports everything as "skipped" and changes nothing.
 *
 * A hotel that already exists is skipped together with its rooms, so the
 * seeder will never inject rooms into a hotel somebody else created.
 *
 * Usage:  npm run seed
 *
 * Credentials come from the environment (backend/.env) — there are NO built-in
 * passwords, and the seeder refuses to run without valid ones:
 *   SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD   (password required)
 *   SEED_USER_EMAIL  / SEED_USER_PASSWORD    (password required)
 * Emails fall back to the existing sample addresses; passwords never do.
 */

// Hotel amenity names deliberately match the vocabulary already in the
// database, so the ?amenity= filter finds these hotels too.
//
// SEED_USERS holds identities only (no password field). Seed users with
// passwords are built at run time by buildSeedUsers() from the environment;
// no passwords live in this file.

const SEED_USERS = describeSeedUsers(process.env);

// pricePerNight is the "from" price shown on the hotel card, so it is always
// the cheapest room in that hotel.
const SEED_HOTELS = [
  {
    name: 'Skyline Suites',
    description:
      'A modern business hotel in the heart of Clifton, with panoramic city views, soundproofed rooms and a rooftop restaurant.',
    location: 'Clifton, Karachi',
    city: 'Karachi',
    country: 'Pakistan',
    address: 'Sea Breeze Plaza, Clifton Block 5, Karachi',
    pricePerNight: 145,
    rating: 4,
    amenities: ['Free WiFi', 'Restaurant', 'Parking', 'Air Conditioning', 'Fitness Center', '24/7 Front Desk'],
    images: [
      'https://images.unsplash.com/photo-1566073771259-6a8506099945',
      'https://images.unsplash.com/photo-1571896349842-33c89424de2d',
      'https://images.unsplash.com/photo-1590490360182-c33d57733427',
    ],
    rooms: [
      {
        roomNumber: '201',
        roomType: 'Standard',
        description: 'Comfortable standard room with a work desk and city view.',
        pricePerNight: 145,
        capacity: 2,
        amenities: ['wifi', 'tv', 'air-conditioning'],
        images: ['https://images.unsplash.com/photo-1571896349842-33c89424de2d'],
        status: 'available',
      },
      {
        roomNumber: '202',
        roomType: 'Deluxe',
        description: 'Larger deluxe room with balcony and separate seating area.',
        pricePerNight: 175,
        capacity: 3,
        amenities: ['wifi', 'tv', 'air-conditioning', 'mini-bar'],
        images: ['https://images.unsplash.com/photo-1590490360182-c33d57733427'],
        status: 'available',
      },
      {
        roomNumber: '203',
        roomType: 'Suite',
        description: 'Executive suite with lounge access and panoramic windows.',
        pricePerNight: 265,
        capacity: 4,
        amenities: ['wifi', 'tv', 'air-conditioning', 'mini-bar', 'balcony'],
        images: ['https://images.unsplash.com/photo-1566073771259-6a8506099945'],
        status: 'available',
      },
    ],
  },
  {
    name: 'Crescent Bay Hotel',
    description:
      'A relaxed seafront hotel with private beach access, five minutes from the promenade and seafood restaurants.',
    location: 'Sea View, Karachi',
    city: 'Karachi',
    country: 'Pakistan',
    address: 'Marine Drive, Sea View Block 2, Karachi',
    pricePerNight: 165,
    rating: 4,
    amenities: ['Free WiFi', 'Beach Access', 'Swimming Pool', 'Restaurant', 'Parking', 'Room Service'],
    images: [
      'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb',
      'https://images.unsplash.com/photo-1582719508461-905c673771fd',
    ],
    rooms: [
      {
        roomNumber: '110',
        roomType: 'Deluxe',
        description: 'Sea-facing deluxe room with a balcony.',
        pricePerNight: 185,
        capacity: 2,
        amenities: ['wifi', 'tv', 'air-conditioning', 'balcony'],
        images: ['https://images.unsplash.com/photo-1542314831-068cd1dbfeeb'],
        status: 'available',
      },
      {
        roomNumber: '111',
        roomType: 'Twin',
        description: 'Twin room with two single beds, ideal for friends travelling together.',
        pricePerNight: 165,
        capacity: 2,
        amenities: ['wifi', 'tv', 'air-conditioning'],
        images: ['https://images.unsplash.com/photo-1582719508461-905c673771fd'],
        status: 'available',
      },
      {
        roomNumber: '112',
        roomType: 'Family',
        description: 'Family room with an extra lounge and kitchenette.',
        pricePerNight: 240,
        capacity: 5,
        amenities: ['wifi', 'tv', 'air-conditioning', 'mini-bar'],
        images: ['https://images.unsplash.com/photo-1540541338287-41700207dee6'],
        status: 'available',
      },
    ],
  },
  {
    name: 'Alpine Lodge',
    description:
      'A quiet hillside lodge with traditional interiors, mountain views and a wood-fired dining room.',
    location: 'Pir Sohawa, Lahore',
    city: 'Lahore',
    country: 'Pakistan',
    address: 'Pir Sohawa Road, Margalla Hills, Lahore',
    pricePerNight: 95,
    rating: 4,
    amenities: ['Free WiFi', 'Restaurant', 'Parking', 'Air Conditioning', 'Room Service'],
    images: [
      'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa',
      'https://images.unsplash.com/photo-1445019980597-93fa8acb246c',
    ],
    rooms: [
      {
        roomNumber: '5',
        roomType: 'Standard',
        description: 'Cosy standard room with a garden view.',
        pricePerNight: 95,
        capacity: 2,
        amenities: ['wifi', 'tv'],
        images: ['https://images.unsplash.com/photo-1445019980597-93fa8acb246c'],
        status: 'available',
      },
      {
        roomNumber: '6',
        roomType: 'Deluxe',
        description: 'Deluxe room with a private balcony facing the valley.',
        pricePerNight: 125,
        capacity: 3,
        amenities: ['wifi', 'tv', 'air-conditioning', 'balcony'],
        images: ['https://images.unsplash.com/photo-1551882547-ff40c63fe5fa'],
        status: 'available',
      },
      {
        roomNumber: '7',
        roomType: 'Suite',
        description: 'Corner suite with fireplace and reading nook.',
        pricePerNight: 185,
        capacity: 4,
        amenities: ['wifi', 'tv', 'air-conditioning', 'mini-bar'],
        images: ['https://images.unsplash.com/photo-1551882547-ff40c63fe5fa'],
        status: 'maintenance',
      },
    ],
  },
  {
    name: 'Saffron Heights',
    description:
      'A boutique hotel near the diplomatic zone, known for its breakfast terrace and quiet, well-appointed rooms.',
    location: 'F-7 Markaz, Islamabad',
    city: 'Islamabad',
    country: 'Pakistan',
    address: 'Jinnah Super Avenue, F-7/3, Islamabad',
    pricePerNight: 140,
    rating: 5,
    amenities: ['Free WiFi', 'Restaurant', 'Parking', 'Air Conditioning', 'Fitness Center', '24/7 Front Desk'],
    images: [
      'https://images.unsplash.com/photo-1564501049412-61c2a3083791',
      'https://images.unsplash.com/photo-1578683010236-d716f9a3f461',
    ],
    rooms: [
      {
        roomNumber: '301',
        roomType: 'Deluxe',
        description: 'Deluxe room with a city view and rainfall shower.',
        pricePerNight: 160,
        capacity: 2,
        amenities: ['wifi', 'tv', 'air-conditioning'],
        images: ['https://images.unsplash.com/photo-1564501049412-61c2a3083791'],
        status: 'available',
      },
      {
        roomNumber: '302',
        roomType: 'Executive',
        description: 'Executive room with lounge access and a writing desk.',
        pricePerNight: 205,
        capacity: 2,
        amenities: ['wifi', 'tv', 'air-conditioning', 'mini-bar'],
        images: ['https://images.unsplash.com/photo-1578683010236-d716f9a3f461'],
        status: 'available',
      },
      {
        roomNumber: '303',
        roomType: 'Suite',
        description: 'Two-room suite with separate living area and breakfast included.',
        pricePerNight: 290,
        capacity: 4,
        amenities: ['wifi', 'tv', 'air-conditioning', 'mini-bar', 'balcony'],
        images: ['https://images.unsplash.com/photo-1578683010236-d716f9a3f461'],
        status: 'available',
      },
      {
        roomNumber: '304',
        roomType: 'Standard',
        description: 'Standard room currently undergoing refurbishment.',
        pricePerNight: 140,
        capacity: 2,
        amenities: ['wifi', 'tv'],
        images: ['https://images.unsplash.com/photo-1564501049412-61c2a3083791'],
        status: 'maintenance',
      },
    ],
  },
  {
    name: 'Desert Rose Resort',
    description:
      'A desert resort built around three courtyard pools, with an oasis spa and dune excursions for guests.',
    location: 'Al Marmoom, Dubai',
    city: 'Dubai',
    country: 'United Arab Emirates',
    address: 'Al Marmoom Desert Conservation Reserve, Dubai',
    pricePerNight: 210,
    rating: 5,
    amenities: ['Free WiFi', 'Swimming Pool', 'Restaurant', 'Parking', 'Air Conditioning', 'Room Service', '24/7 Front Desk'],
    images: [
      'https://images.unsplash.com/photo-1611892440504-42a792e24d32',
      'https://images.unsplash.com/photo-1520250497591-112f2f40a3f4',
    ],
    rooms: [
      {
        roomNumber: '401',
        roomType: 'Deluxe',
        description: 'Poolside deluxe room with a shaded terrace.',
        pricePerNight: 210,
        capacity: 2,
        amenities: ['wifi', 'tv', 'air-conditioning', 'mini-bar'],
        images: ['https://images.unsplash.com/photo-1611892440504-42a792e24d32'],
        status: 'available',
      },
      {
        roomNumber: '402',
        roomType: 'Suite',
        description: 'Suite with private plunge pool and dune views.',
        pricePerNight: 380,
        capacity: 4,
        amenities: ['wifi', 'tv', 'air-conditioning', 'mini-bar', 'balcony'],
        images: ['https://images.unsplash.com/photo-1520250497591-112f2f40a3f4'],
        status: 'available',
      },
    ],
  },
  {
    name: 'Harbour View Inn',
    description:
      'A small historic inn overlooking the harbour, with a cosy pub, breakfast included and a walkable dockside location.',
    location: 'Dockside, London',
    city: 'London',
    country: 'United Kingdom',
    address: '14 Wapping Wharf, London',
    pricePerNight: 130,
    rating: 3,
    amenities: ['Free WiFi', 'Restaurant', 'Air Conditioning', '24/7 Front Desk'],
    images: [
      'https://images.unsplash.com/photo-1540541338287-41700207dee6',
      'https://images.unsplash.com/photo-1566073771259-6a8506099945',
    ],
    rooms: [
      {
        roomNumber: '12',
        roomType: 'Standard',
        description: 'Compact double room with harbour view.',
        pricePerNight: 130,
        capacity: 2,
        amenities: ['wifi', 'tv'],
        images: ['https://images.unsplash.com/photo-1540541338287-41700207dee6'],
        status: 'available',
      },
      {
        roomNumber: '13',
        roomType: 'Twin',
        description: 'Spacious twin room with a private bathroom.',
        pricePerNight: 155,
        capacity: 2,
        amenities: ['wifi', 'tv', 'air-conditioning'],
        images: ['https://images.unsplash.com/photo-1566073771259-6a8506099945'],
        status: 'available',
      },
    ],
  },
];

const tally = { created: 0, skipped: 0 };

async function seedUser(def) {
  // The User schema lowercases emails, so normalise before looking one up.
  const email = def.email.toLowerCase();
  const existing = await User.findOne({ email });

  if (existing) {
    tally.skipped += 1;
    console.log(`  = user   ${email} already exists (role: ${existing.role}) — skipped`);
    return existing;
  }

  // create() so the model's pre-save hook bcrypt-hashes the password.
  const user = await User.create({ name: def.name, email, password: def.password, role: def.role });
  tally.created += 1;
  console.log(`  + user   ${email} (role: ${user.role})`);
  return user;
}

async function seedHotel(def) {
  const { rooms, ...hotelData } = def;
  const existing = await Hotel.findOne({ name: hotelData.name, city: hotelData.city });

  if (existing) {
    // Skip the hotel *and* its rooms: this hotel may not be ours, and adding
    // rooms to somebody else's record would not be non-destructive.
    const roomCount = await Room.countDocuments({ hotel: existing._id });
    tally.skipped += 1;
    console.log(`\n  = hotel  ${existing.name} (${existing.city}) already exists — skipped`);
    console.log(`           (${roomCount} room${roomCount === 1 ? '' : 's'} left untouched)`);
    return existing;
  }

  const hotel = await Hotel.create({ ...hotelData, totalRooms: rooms.length });
  tally.created += 1;
  console.log(`\n  + hotel  ${hotel.name} (${hotel.city}, ${hotel.country}) — ${hotelData.rating} stars, from $${hotel.pricePerNight}`);

  for (const roomData of rooms) {
    const room = await Room.create({ ...roomData, hotel: hotel._id });
    tally.created += 1;
    console.log(`      + room  ${room.roomNumber.padStart(4)}  ${room.roomType.padEnd(10)} $${room.pricePerNight}/night  up to ${room.capacity} guest(s)  [${room.status}]`);
  }

  return hotel;
}

let activeSecrets = [];

async function run() {
  // Validate credentials BEFORE connecting, so a bad config never touches the DB.
  const seedUsers = buildSeedUsers(process.env);
  activeSecrets = seedUsers.map((user) => user.password);

  await connectDB();
  console.log('\nSeeding StayEasy sample data — inserts only, nothing is modified or deleted.\n');

  console.log('Users');
  for (const def of seedUsers) {
    await seedUser(def);
  }

  console.log('\nHotels and rooms');
  for (const def of SEED_HOTELS) {
    await seedHotel(def);
  }

  console.log(`\nDone. ${tally.created} created, ${tally.skipped} skipped.`);
  console.log('Run it again and everything will be reported as skipped — that is the expected idempotent behaviour.');
  console.log('\nSeeded accounts (passwords are the values you set in your environment; they are never printed):');
  for (const def of seedUsers) {
    console.log(`  ${def.role.padEnd(5)}  ${def.email}`);
  }
}

// Exported so the seed data can be validated against the schemas without
// connecting to a database.
module.exports = { SEED_USERS, SEED_HOTELS, buildSeedUsers, resolveSeedPasswords };

// Only run when invoked directly, so requiring this file for a test or a
// re-use of the data does not insert anything.
if (require.main === module) {
  run()
    .then(async () => {
      await mongoose.disconnect();
    })
    .catch(async (error) => {
      if (error instanceof SeedConfigError) {
        console.error(`\n${error.message}`);
      } else {
        // Never echo a credential: drop validation detail, redact the rest.
        const detail = error && error.name === 'ValidationError'
          ? `validation failed for: ${Object.keys(error.errors || {}).join(', ')}`
          : redact(error && error.message, activeSecrets);
        console.error('\nSeed failed:', detail);
      }
      await mongoose.disconnect().catch(() => {});
      process.exit(1);
    });
}
