const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
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
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: [true, 'Booking reference is required'],
    },
    rating: {
      type: Number,
      required: [true, 'Rating is required'],
      min: [1, 'Rating must be at least 1'],
      max: [5, 'Rating cannot be more than 5'],
    },
    comment: {
      type: String,
      required: [true, 'Comment is required'],
      trim: true,
    },
    status: {
      type: String,
      enum: ['visible', 'hidden'],
      default: 'visible',
    },
  },
  { timestamps: true }
);

// One review per booking
reviewSchema.index({ booking: 1 }, { unique: true });

// Hotel pages list a hotel's visible reviews and the rating recalculation
// averages them; both filter by hotel and status.
reviewSchema.index({ hotel: 1, status: 1 });

module.exports = mongoose.model('Review', reviewSchema);
