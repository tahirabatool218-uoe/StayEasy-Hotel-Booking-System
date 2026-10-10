const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const Hotel = require('../models/Hotel');
const Room = require('../models/Room');
const Review = require('../models/Review');
const { roomHasOverlappingBooking, getStayKeys } = require('../utils/bookingAvailability');
const {
  parseCalendarDate,
  startOfUtcDay,
  calculateNights,
  getToday,
  validateStayRange,
  parseGuests,
  calculateTotalPrice,
  getBookabilityError,
  getCapacityError,
} = require('../utils/bookingValidation');
const { serverError } = require('../utils/httpErrors');

const POPULATE_OPTIONS = [
  { path: 'user', select: 'name email' },
  { path: 'hotel', select: 'name city country' },
  { path: 'room', select: 'roomNumber roomType' },
];

const BOOKING_STATUSES = ['pending', 'confirmed', 'cancelled', 'completed'];

const INVALID_DATES_MESSAGE =
  'checkInDate and checkOutDate must be valid calendar dates in YYYY-MM-DD format';

// @desc    Create a new booking
// @route   POST /api/bookings
// @access  Private (any authenticated user)
const createBooking = async (req, res) => {
  try {
    const { hotel, room, checkInDate, checkOutDate, guests } = req.body;

    if (!hotel || !room || !checkInDate || !checkOutDate || guests === undefined) {
      return res.status(400).json({
        message: 'Please provide hotel, room, checkInDate, checkOutDate and guests',
      });
    }

    if (!mongoose.Types.ObjectId.isValid(hotel)) {
      return res.status(400).json({ message: 'Invalid hotel ID' });
    }
    if (!mongoose.Types.ObjectId.isValid(room)) {
      return res.status(400).json({ message: 'Invalid room ID' });
    }

    const parsedGuests = parseGuests(guests);
    if (parsedGuests.error) {
      return res.status(400).json({ message: parsedGuests.error });
    }
    const guestCount = parsedGuests.guests;

    const checkIn = parseCalendarDate(checkInDate);
    const checkOut = parseCalendarDate(checkOutDate);

    if (!checkIn || !checkOut) {
      return res.status(400).json({ message: INVALID_DATES_MESSAGE });
    }

    const rangeError = validateStayRange(checkIn, checkOut, { requireFutureCheckIn: true });
    if (rangeError) {
      return res.status(400).json({ message: rangeError });
    }

    const hotelDoc = await Hotel.findById(hotel);
    if (!hotelDoc) {
      return res.status(404).json({ message: 'Hotel not found' });
    }

    const roomDoc = await Room.findById(room);
    if (!roomDoc) {
      return res.status(404).json({ message: 'Room not found' });
    }

    // Hotel must be active (not hidden), the room must belong to it and be
    // marked available, and it must sleep the requested number of guests.
    const bookabilityError = getBookabilityError(hotelDoc, roomDoc) || getCapacityError(roomDoc, guestCount);
    if (bookabilityError) {
      return res.status(400).json({ message: bookabilityError });
    }

    // Cheap pre-check, so a clash found while the visitor was still waiting is
    // reported with a friendly message. It is NOT the guarantee: this check and
    // the insert below are two separate operations, so two simultaneous requests
    // for the same room and dates could both pass it.
    //
    // The guarantee is the UNIQUE index on Booking.stayKeys (see models/Booking.js).
    // Every non-cancelled booking claims one key per night, so a second booking
    // that overlaps the first is rejected by the database itself even when both
    // requests interleave. The duplicate-key error below turns that into the
    // same 409 the pre-check produces.
    const isConflicting = await roomHasOverlappingBooking(roomDoc._id, checkIn, checkOut);
    if (isConflicting) {
      return res.status(409).json({ message: 'Room is already booked for the selected dates' });
    }

    // totalPrice is always derived server-side from the room's real price and
    // the number of calendar nights — any totalPrice sent by the client is
    // ignored.
    const nights = calculateNights(checkIn, checkOut);
    const totalPrice = calculateTotalPrice(roomDoc.pricePerNight, nights);

    const booking = await Booking.create({
      user: req.user._id,
      hotel: hotelDoc._id,
      room: roomDoc._id,
      checkInDate: checkIn,
      checkOutDate: checkOut,
      guests: guestCount,
      totalPrice,
      stayKeys: getStayKeys(roomDoc._id, checkIn, checkOut, 'pending'),
    });

    await booking.populate(POPULATE_OPTIONS);

    return res.status(201).json(booking);
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    // Lost the race: another request claimed one of these nights between the
    // pre-check above and this insert. Same outcome as a clash found earlier.
    if (error.code === 11000 && error.keyPattern?.stayKeys) {
      return res.status(409).json({ message: 'Room is already booked for the selected dates' });
    }
    return serverError(res, error);
  }
};

// @desc    Get the authenticated user's own bookings
// @route   GET /api/bookings/my
// @access  Private
const getMyBookings = async (req, res) => {
  try {
    const bookings = await Booking.find({ user: req.user._id })
      .populate(POPULATE_OPTIONS)
      .sort({ createdAt: -1 });

    return res.status(200).json(bookings);
  } catch (error) {
    return serverError(res, error);
  }
};

// @desc    Get all bookings
// @route   GET /api/bookings
// @access  Private/Admin
const getAllBookings = async (req, res) => {
  try {
    const bookings = await Booking.find()
      .populate(POPULATE_OPTIONS)
      .sort({ createdAt: -1 });

    return res.status(200).json(bookings);
  } catch (error) {
    return serverError(res, error);
  }
};

// @desc    Get a single booking by ID
// @route   GET /api/bookings/:id
// @access  Private (owner or admin)
const getBookingById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid booking ID' });
    }

    const booking = await Booking.findById(id).populate(POPULATE_OPTIONS);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    const isOwner = booking.user._id.toString() === req.user._id.toString();
    if (!isOwner && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden: you can only view your own bookings' });
    }

    return res.status(200).json(booking);
  } catch (error) {
    return serverError(res, error);
  }
};

// @desc    Update a booking
//          Admin: can update status and other allowed booking fields.
//          Normal user: can only cancel their own booking (set status to 'cancelled').
// @route   PUT /api/bookings/:id
// @access  Private (owner or admin)
const updateBooking = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid booking ID' });
    }

    const booking = await Booking.findById(id);
    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    const isOwner = booking.user.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Forbidden: you can only modify your own bookings' });
    }

    if (isAdmin) {
      // `room`, `hotel`, `user` and `totalPrice` are not editable: the booking
      // keeps its room, and the price is always recomputed server-side.
      const ALLOWED_ADMIN_FIELDS = ['status', 'guests', 'checkInDate', 'checkOutDate'];
      const updates = {};
      for (const field of ALLOWED_ADMIN_FIELDS) {
        if (req.body[field] !== undefined) updates[field] = req.body[field];
      }

      if (updates.status !== undefined && !BOOKING_STATUSES.includes(updates.status)) {
        return res.status(400).json({ message: 'Invalid status value' });
      }

      let guestCount;
      if (updates.guests !== undefined) {
        const parsedGuests = parseGuests(updates.guests);
        if (parsedGuests.error) {
          return res.status(400).json({ message: parsedGuests.error });
        }
        guestCount = parsedGuests.guests;
      }

      // A completed stay is a historical record (it may carry a review), so its
      // status is final. Re-sending "completed" is a harmless no-op.
      if (booking.status === 'completed' && updates.status !== undefined && updates.status !== 'completed') {
        return res.status(400).json({ message: 'A completed booking cannot change status' });
      }

      const finalStatus = updates.status !== undefined ? updates.status : booking.status;
      const blocksRoom = finalStatus !== 'cancelled';

      // Dates: compare as calendar days. A date sent back unchanged is treated
      // as "no change", so an edit never rewrites a stored value for nothing.
      const currentCheckIn = startOfUtcDay(booking.checkInDate);
      const currentCheckOut = startOfUtcDay(booking.checkOutDate);
      let newCheckIn = currentCheckIn;
      let newCheckOut = currentCheckOut;

      if (updates.checkInDate !== undefined) {
        newCheckIn = parseCalendarDate(updates.checkInDate);
      }
      if (updates.checkOutDate !== undefined) {
        newCheckOut = parseCalendarDate(updates.checkOutDate);
      }
      if (!newCheckIn || !newCheckOut) {
        return res.status(400).json({ message: INVALID_DATES_MESSAGE });
      }

      const checkInChanged = newCheckIn.getTime() !== currentCheckIn.getTime();
      const checkOutChanged = newCheckOut.getTime() !== currentCheckOut.getTime();
      const datesChanged = checkInChanged || checkOutChanged;

      if (updates.checkInDate !== undefined || updates.checkOutDate !== undefined) {
        // A *new* check-in may not be in the past for a live booking. Editing
        // only the check-out (extending a stay in progress) or correcting the
        // dates of a completed/cancelled booking is allowed.
        const liveBooking = finalStatus === 'pending' || finalStatus === 'confirmed';
        const rangeError = validateStayRange(newCheckIn, newCheckOut, {
          requireFutureCheckIn: checkInChanged && liveBooking,
          today: getToday(),
        });
        if (rangeError) {
          return res.status(400).json({ message: rangeError });
        }
      }

      const guestsChanged = guestCount !== undefined && guestCount !== booking.guests;
      const reactivating = booking.status === 'cancelled' && finalStatus !== 'cancelled';
      const confirming = finalStatus === 'confirmed' && booking.status !== 'confirmed';

      // Anything that (re)claims the room or changes who sleeps in it must
      // pass the same rules as a new booking.
      let roomDoc = null;
      if (datesChanged || guestsChanged || reactivating) {
        const [loadedRoom, hotelDoc] = await Promise.all([
          Room.findById(booking.room),
          Hotel.findById(booking.hotel),
        ]);
        if (!loadedRoom || !hotelDoc) {
          return res.status(409).json({
            message:
              "This booking's hotel or room no longer exists, so these changes cannot be validated. " +
              'You can still cancel the booking.',
          });
        }
        roomDoc = loadedRoom;

        const capacityError = getCapacityError(roomDoc, guestCount !== undefined ? guestCount : booking.guests);
        if (capacityError && (guestsChanged || reactivating)) {
          return res.status(400).json({ message: capacityError });
        }

        if (blocksRoom && (datesChanged || reactivating)) {
          const bookabilityError = getBookabilityError(hotelDoc, roomDoc);
          if (bookabilityError) {
            return res.status(409).json({ message: bookabilityError });
          }
        }
      }

      // Same overlap rule as creation, excluding this booking itself.
      if (blocksRoom && (datesChanged || reactivating || confirming)) {
        const conflict = await roomHasOverlappingBooking(
          booking.room,
          checkInChanged ? newCheckIn : booking.checkInDate,
          checkOutChanged ? newCheckOut : booking.checkOutDate,
          { excludeBookingId: booking._id }
        );
        if (conflict) {
          return res.status(409).json({
            message: 'This room already has another booking for those dates, so this booking cannot be saved as active.',
          });
        }
      }

      // Apply only what actually changed, using validated values.
      delete updates.checkInDate;
      delete updates.checkOutDate;
      delete updates.guests;
      if (checkInChanged) updates.checkInDate = newCheckIn;
      if (checkOutChanged) updates.checkOutDate = newCheckOut;
      if (guestsChanged) updates.guests = guestCount;
      if (datesChanged) {
        updates.totalPrice = calculateTotalPrice(
          roomDoc.pricePerNight,
          calculateNights(newCheckIn, newCheckOut)
        );
      }

      Object.assign(booking, updates);
      // Keep the claimed nights in step with the final room/dates/status, so
      // the unique stayKeys index still describes exactly what this booking
      // occupies. Always recomputed rather than only when something changed —
      // it is cheap and cannot drift.
      booking.stayKeys = getStayKeys(
        booking.room,
        booking.checkInDate,
        booking.checkOutDate,
        booking.status
      );
      await booking.save();
    } else {
      // Normal user: the only allowed action is cancelling their own booking.
      const bodyKeys = Object.keys(req.body);
      const onlyStatusField = bodyKeys.length === 1 && bodyKeys[0] === 'status';

      if (!onlyStatusField || req.body.status !== 'cancelled') {
        return res.status(400).json({
          message: 'You can only cancel your own booking by sending { "status": "cancelled" }',
        });
      }

      if (booking.status === 'completed') {
        return res.status(400).json({ message: 'Cannot cancel a completed booking' });
      }
      if (booking.status === 'cancelled') {
        return res.status(400).json({ message: 'Booking is already cancelled' });
      }

      booking.status = 'cancelled';
      // Cancelling frees the room: drop the claimed nights so this booking
      // stops conflicting with any other (see models/Booking.js).
      booking.stayKeys = getStayKeys(booking.room, booking.checkInDate, booking.checkOutDate, 'cancelled');
      await booking.save();
    }

    await booking.populate(POPULATE_OPTIONS);
    return res.status(200).json(booking);
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    // An admin edit moved this booking onto nights another booking already
    // holds. Report it as a conflict so the 500 path stays for real faults.
    if (error.code === 11000 && error.keyPattern?.stayKeys) {
      return res.status(409).json({
        message:
          'This room already has another booking for those dates, so this booking cannot be saved as active.',
      });
    }
    return serverError(res, error);
  }
};

// @desc    Delete a booking
// @route   DELETE /api/bookings/:id
// @access  Private/Admin
const deleteBooking = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid booking ID' });
    }

    const existing = await Booking.findById(id).select('_id');
    if (!existing) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // A review is tied to its booking; deleting the booking would orphan it.
    if (await Review.exists({ booking: id })) {
      return res.status(409).json({ message: 'This booking has a review and cannot be deleted' });
    }

    // deleteOne (not findByIdAndDelete): same effect, and it reports whether
    // anything was removed if the booking vanished since the checks above.
    const { deletedCount } = await Booking.deleteOne({ _id: id });
    if (!deletedCount) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    return res.status(200).json({ message: 'Booking deleted successfully' });
  } catch (error) {
    return serverError(res, error);
  }
};

module.exports = {
  createBooking,
  getMyBookings,
  getAllBookings,
  getBookingById,
  updateBooking,
  deleteBooking,
};
