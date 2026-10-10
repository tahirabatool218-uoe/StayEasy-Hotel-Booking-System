const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema(
  {
    hotel: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Hotel',
      required: [true, 'Hotel reference is required'],
    },
    roomNumber: {
      type: String,
      required: [true, 'Room number is required'],
      trim: true,
    },
    roomType: {
      type: String,
      required: [true, 'Room type is required'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
    },
    pricePerNight: {
      type: Number,
      required: [true, 'Price per night is required'],
      min: [0, 'Price per night cannot be negative'],
    },
    capacity: {
      type: Number,
      required: [true, 'Capacity is required'],
      min: [1, 'Capacity must be at least 1'],
    },
    amenities: {
      type: [String],
      default: [],
    },
    images: {
      type: [String],
      default: [],
    },
    status: {
      type: String,
      enum: ['available', 'maintenance', 'inactive'],
      default: 'available',
    },
  },
  { timestamps: true }
);

// Room lookups are almost always "rooms of this hotel" (optionally by status):
// listings, availability search and room counts. NOT unique: room-number
// uniqueness within a hotel is enforced by the controller, and by the unique
// {hotel, roomNumber} index created with `npm run rooms:create-index` once
// `npm run rooms:check` reports no duplicates in existing data.
roomSchema.index({ hotel: 1, status: 1 });

module.exports = mongoose.model('Room', roomSchema);
