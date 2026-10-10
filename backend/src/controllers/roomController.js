const mongoose = require('mongoose');
const Room = require('../models/Room');
const Hotel = require('../models/Hotel');
const Booking = require('../models/Booking');
const { getOverlapQuery } = require('../utils/bookingAvailability');
const {
  parseCalendarDate,
  validateStayRange,
  parseGuests,
} = require('../utils/bookingValidation');
const { serverError } = require('../utils/httpErrors');
const { validateImageUrls } = require('../utils/validators');
const { syncHotelRoomCounts } = require('../utils/roomCounts');

// Fields a client is allowed to set/update on a room.
const ALLOWED_FIELDS = [
  'hotel',
  'roomNumber',
  'roomType',
  'description',
  'pricePerNight',
  'capacity',
  'amenities',
  'images',
  'status',
];

const HOTEL_POPULATE = { path: 'hotel', select: 'name city country' };

const pickAllowedFields = (body) => {
  const data = {};
  for (const field of ALLOWED_FIELDS) {
    if (body[field] !== undefined) {
      data[field] = body[field];
    }
  }
  return data;
};

// A room number identifies a room inside its hotel ('101' may exist in two
// different hotels, never twice in one). Only primitives are compared: any
// other type is left for the schema to reject with its normal 400.
const normalizeRoomNumber = (value) =>
  typeof value === 'string' || typeof value === 'number' ? String(value).trim() : null;

const DUPLICATE_ROOM_MESSAGE = 'A room with this number already exists in this hotel.';

const isDuplicateKeyError = (error) => error && (error.code === 11000 || error.code === 11001);

// @desc    Create a new room
// @route   POST /api/rooms
// @access  Private/Admin
const createRoom = async (req, res) => {
  try {
    const {
      hotel,
      roomNumber,
      roomType,
      description,
      pricePerNight,
      capacity,
    } = req.body;

    if (!hotel || !roomNumber || !roomType || !description || pricePerNight === undefined || capacity === undefined) {
      return res.status(400).json({
        message: 'Please provide hotel, roomNumber, roomType, description, pricePerNight and capacity',
      });
    }

    if (!mongoose.Types.ObjectId.isValid(hotel)) {
      return res.status(400).json({ message: 'Invalid hotel ID' });
    }

    const hotelExists = await Hotel.findById(hotel);
    if (!hotelExists) {
      return res.status(404).json({ message: 'Hotel not found' });
    }

    const roomData = pickAllowedFields(req.body);
    if (roomData.images !== undefined) {
      const parsedImages = validateImageUrls(roomData.images);
      if (parsedImages.error) return res.status(400).json({ message: parsedImages.error });
      roomData.images = parsedImages.value;
    }

    const number = normalizeRoomNumber(roomData.roomNumber);
    if (number !== null && (await Room.exists({ hotel, roomNumber: number }))) {
      return res.status(409).json({ message: DUPLICATE_ROOM_MESSAGE });
    }

    const room = await Room.create(roomData);
    await syncHotelRoomCounts([room.hotel]);
    await room.populate(HOTEL_POPULATE);

    return res.status(201).json(room);
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    if (isDuplicateKeyError(error)) {
      return res.status(409).json({ message: DUPLICATE_ROOM_MESSAGE });
    }
    return serverError(res, error);
  }
};

// @desc    Get rooms, optionally filtered by hotel and/or status.
//          Rooms of hidden (inactive) hotels are only returned to admins.
// @route   GET /api/rooms?hotel=<id>&status=available
// @access  Public (optional auth)
// Response is always a plain array (no envelope), matching /api/rooms/availability.
const getRooms = async (req, res) => {
  try {
    const { hotel, status } = req.query;
    const query = {};
    const isAdmin = req.user?.role === 'admin';

    // Filtering by hotel is what powers the "Our Rooms" list on the hotel
    // details page. It is deliberately independent of the date-based
    // availability search, which lives on /api/rooms/availability.
    if (hotel) {
      if (!mongoose.Types.ObjectId.isValid(hotel)) {
        return res.status(400).json({ message: 'Invalid hotel ID' });
      }
      query.hotel = hotel;

      if (!isAdmin) {
        const visibleHotel = await Hotel.exists({ _id: hotel, isActive: true });
        if (!visibleHotel) {
          return res.status(200).json([]);
        }
      }
    } else if (!isAdmin) {
      // No hotel filter: restrict to rooms whose hotel is currently visible.
      // This also drops rooms whose hotel no longer exists.
      const visibleHotelIds = await Hotel.distinct('_id', { isActive: true });
      query.hotel = { $in: visibleHotelIds };
    }

    if (status) {
      const validStatuses = ['available', 'maintenance', 'inactive'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: `status must be one of: ${validStatuses.join(', ')}` });
      }
      query.status = status;
    }

    const rooms = await Room.find(query)
      .populate(HOTEL_POPULATE)
      .sort({ createdAt: -1 });
    return res.status(200).json(rooms);
  } catch (error) {
    return serverError(res, error);
  }
};

// @desc    Get a single room by ID (with hotel info populated).
//          A room of a hidden hotel is only returned to admins.
// @route   GET /api/rooms/:id
// @access  Public (optional auth)
const getRoomById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid room ID' });
    }

    const room = await Room.findById(id).populate(HOTEL_POPULATE);
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    if (req.user?.role !== 'admin') {
      // `room.hotel` is null when the hotel no longer exists.
      const visibleHotel = room.hotel && (await Hotel.exists({ _id: room.hotel._id, isActive: true }));
      if (!visibleHotel) {
        return res.status(404).json({ message: 'Room not found' });
      }
    }

    return res.status(200).json(room);
  } catch (error) {
    return serverError(res, error);
  }
};

// @desc    Update a room
// @route   PUT /api/rooms/:id
// @access  Private/Admin
const updateRoom = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid room ID' });
    }

    const updateData = pickAllowedFields(req.body);
    if (updateData.images !== undefined) {
      const parsedImages = validateImageUrls(updateData.images);
      if (parsedImages.error) return res.status(400).json({ message: parsedImages.error });
      updateData.images = parsedImages.value;
    }

    // If the caller is moving the room to a different hotel, that hotel must exist
    if (updateData.hotel !== undefined) {
      if (!mongoose.Types.ObjectId.isValid(updateData.hotel)) {
        return res.status(400).json({ message: 'Invalid hotel ID' });
      }
      const hotelExists = await Hotel.findById(updateData.hotel);
      if (!hotelExists) {
        return res.status(404).json({ message: 'Hotel not found' });
      }
    }

    // The room as it is now: needed to detect a move to another hotel (to keep
    // booking history consistent and to resync both hotels' room counts) and to
    // check room-number uniqueness against the hotel the room will end up in.
    const needsCurrent = updateData.hotel !== undefined || updateData.roomNumber !== undefined;
    const current = needsCurrent ? await Room.findById(id).select('hotel roomNumber') : null;

    let previousHotelId = null;
    if (current) {
      const targetHotelId = updateData.hotel !== undefined ? String(updateData.hotel) : String(current.hotel);

      if (current.hotel && String(current.hotel) !== targetHotelId) {
        previousHotelId = current.hotel;

        // Bookings store both `hotel` and `room`. Moving a room that already has
        // bookings would leave them pointing at a hotel the room is no longer in.
        const bookingCount = await Booking.countDocuments({ room: id });
        if (bookingCount > 0) {
          return res.status(409).json({
            message:
              `Cannot move this room to another hotel: it has ${bookingCount} booking(s) on record. ` +
              'Create a new room in the other hotel and set this one to inactive instead.',
          });
        }
      }

      const targetNumber = normalizeRoomNumber(
        updateData.roomNumber !== undefined ? updateData.roomNumber : current.roomNumber
      );
      const hotelOrNumberChanged =
        previousHotelId !== null || (updateData.roomNumber !== undefined && targetNumber !== String(current.roomNumber).trim());
      if (
        hotelOrNumberChanged &&
        targetNumber !== null &&
        (await Room.exists({ hotel: targetHotelId, roomNumber: targetNumber, _id: { $ne: id } }))
      ) {
        return res.status(409).json({ message: DUPLICATE_ROOM_MESSAGE });
      }
    }

    const room = await Room.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    ).populate(HOTEL_POPULATE);

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    if (previousHotelId) {
      await syncHotelRoomCounts([previousHotelId, updateData.hotel]);
    }

    return res.status(200).json(room);
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    if (isDuplicateKeyError(error)) {
      return res.status(409).json({ message: DUPLICATE_ROOM_MESSAGE });
    }
    return serverError(res, error);
  }
};

// @desc    Get rooms in a hotel that are available for a given date range and guest count
// @route   GET /api/rooms/availability
// @access  Public
const getRoomAvailability = async (req, res) => {
  try {
    const { hotel, checkInDate, checkOutDate, guests } = req.query;

    if (!hotel || !checkInDate || !checkOutDate || guests === undefined) {
      return res.status(400).json({
        message: 'Please provide hotel, checkInDate, checkOutDate and guests',
      });
    }

    if (!mongoose.Types.ObjectId.isValid(hotel)) {
      return res.status(400).json({ message: 'Invalid hotel ID' });
    }

    // Availability only makes sense for a hotel that can actually be booked,
    // so a hidden hotel is reported as not found (for admins too).
    const hotelDoc = await Hotel.findById(hotel);
    if (!hotelDoc || !hotelDoc.isActive) {
      return res.status(404).json({ message: 'Hotel not found' });
    }

    // Same date/guest rules as booking creation, so a search never reports a
    // room as available for a request that creating the booking would reject.
    const checkIn = parseCalendarDate(checkInDate);
    const checkOut = parseCalendarDate(checkOutDate);

    if (!checkIn || !checkOut) {
      return res.status(400).json({
        message: 'checkInDate and checkOutDate must be valid calendar dates in YYYY-MM-DD format',
      });
    }

    const rangeError = validateStayRange(checkIn, checkOut, { requireFutureCheckIn: true });
    if (rangeError) {
      return res.status(400).json({ message: rangeError });
    }

    const parsedGuests = parseGuests(guests);
    if (parsedGuests.error) {
      return res.status(400).json({ message: parsedGuests.error });
    }
    const guestsNum = parsedGuests.guests;

    // Rooms in this hotel, currently marked available, with enough capacity
    const candidateRooms = await Room.find({
      hotel,
      status: 'available',
      capacity: { $gte: guestsNum },
    });

    if (candidateRooms.length === 0) {
      return res.status(200).json([]);
    }

    // Find any active (non-cancelled) booking on these rooms that overlaps
    // the requested range (same overlap rule used by booking creation).
    const overlappingBookings = await Booking.find({
      room: { $in: candidateRooms.map((r) => r._id) },
      ...getOverlapQuery(checkIn, checkOut),
    }).select('room');

    const bookedRoomIds = new Set(overlappingBookings.map((b) => b.room.toString()));

    const availableRooms = candidateRooms.filter(
      (room) => !bookedRoomIds.has(room._id.toString())
    );

    return res.status(200).json(availableRooms);
  } catch (error) {
    return serverError(res, error);
  }
};

// @desc    Delete a room
// @route   DELETE /api/rooms/:id
// @access  Private/Admin
const deleteRoom = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid room ID' });
    }

    const room = await Room.findById(id);
    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    // Every booking (any status, past or future) holds a required reference to
    // its room. Deleting the room would orphan that history, so refuse and
    // point at the non-destructive alternative: the existing 'inactive' status.
    const bookingCount = await Booking.countDocuments({ room: room._id });
    if (bookingCount > 0) {
      return res.status(409).json({
        message:
          `Cannot delete this room: it has ${bookingCount} booking(s) on record, including past or cancelled ones. ` +
          'Set its status to "inactive" instead so it stops taking new bookings while its history is kept.',
      });
    }

    await room.deleteOne();
    await syncHotelRoomCounts([room.hotel]);

    return res.status(200).json({ message: 'Room deleted successfully' });
  } catch (error) {
    return serverError(res, error);
  }
};

module.exports = {
  createRoom,
  getRooms,
  getRoomById,
  getRoomAvailability,
  updateRoom,
  deleteRoom,
};
