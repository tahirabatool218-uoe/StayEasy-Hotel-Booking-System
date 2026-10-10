const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
    },
    hotel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hotel',
      required: [true, 'Hotel reference is required'],
    },
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Room',
      required: [true, 'Room reference is required'],
    },
    checkInDate: {
      type: Date,
      required: [true, 'Check-in date is required'],
    },
    checkOutDate: {
      type: Date,
      required: [true, 'Check-out date is required'],
      validate: {
        validator: function (value) {
          // `this` refers to the document being validated (works for create
          // and for .save(); findOneAndUpdate needs runValidators + context:'query',
          // which the controller sets explicitly when checkOutDate is touched)
          return this.checkInDate && value > this.checkInDate;
        },
        message: 'checkOutDate must be later than checkInDate',
      },
    },
    guests: {
      type: Number,
      required: [true, 'Number of guests is required'],
      min: [1, 'There must be at least 1 guest'],
    },
    totalPrice: {
      type: Number,
      required: [true, 'Total price is required'],
      min: [0, 'Total price cannot be negative'],
    },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'cancelled', 'completed'],
      default: 'pending',
    },
    // One entry per night this booking occupies the room ("<roomId>:<date>").
    // Derived server-side by getStayKeys (utils/bookingAvailability.js) and
    // never read from a request. Empty for cancelled bookings, so they claim
    // nothing. See the unique index below.
    stayKeys: {
      type: [String],
      default: [],
      select: false,
    },
  },
  { timestamps: true }
);

// Availability and overlap checks look up bookings by room and date range;
// "my bookings" filters by user; delete-protection and counts filter by hotel.
bookingSchema.index({ room: 1, checkInDate: 1, checkOutDate: 1 });
bookingSchema.index({ user: 1, createdAt: -1 });
bookingSchema.index({ hotel: 1 });

// The atomic double-booking guard. Two bookings on the same room whose ranges
// overlap must share at least one night, so both would try to store the same
// "<roomId>:<date>" key and MongoDB rejects the second write. The controller's
// overlap check stays as a cheap, friendly pre-check; this index is what makes
// the guarantee hold under concurrency.
//
// A unique multikey index: values are only compared *between* documents, so one
// booking holding several distinct nights is fine, and a cancelled booking's
// empty array contributes no entries at all.
//
// Existing databases may already hold overlapping bookings, which would make
// the build fail. Check with `npm run bookings:check` and create the index
// with `npm run bookings:create-index` — the same two-step the room-number
// index uses. New databases get it automatically.
bookingSchema.index({ stayKeys: 1 }, { unique: true, name: 'booking_staykeys_unique' });

module.exports = mongoose.model('Booking', bookingSchema);
