const mongoose = require('mongoose');
const Review = require('../models/Review');
const Booking = require('../models/Booking');
const Hotel = require('../models/Hotel');
const { serverError } = require('../utils/httpErrors');

const USER_POPULATE = { path: 'user', select: 'name' };
const HOTEL_POPULATE = { path: 'hotel', select: 'name' };
const FULL_POPULATE = [
  { path: 'user', select: 'name email' },
  { path: 'hotel', select: 'name city country' },
];

// Recalculate a hotel's average rating from its visible reviews only,
// and persist it on the Hotel document. Never trust a client-sent rating.
const recalculateHotelRating = async (hotelId) => {
  const stats = await Review.aggregate([
    {
      $match: {
        hotel: new mongoose.Types.ObjectId(hotelId),
        status: 'visible',
      },
    },
    {
      $group: {
        _id: '$hotel',
        avgRating: { $avg: '$rating' },
      },
    },
  ]);

  const rating = stats.length > 0 ? stats[0].avgRating : 0;

  await Hotel.findByIdAndUpdate(hotelId, {
    rating: Math.round(rating * 10) / 10,
  });
};

// @desc    Create a new review for a completed booking
// @route   POST /api/reviews
// @access  Private (any authenticated user)
const createReview = async (req, res) => {
  try {
    const { hotel, booking, rating, comment } = req.body;

    if (!hotel || !booking || rating === undefined || !comment) {
      return res.status(400).json({
        message: 'Please provide hotel, booking, rating and comment',
      });
    }

    if (!mongoose.Types.ObjectId.isValid(hotel)) {
      return res.status(400).json({ message: 'Invalid hotel ID' });
    }
    if (!mongoose.Types.ObjectId.isValid(booking)) {
      return res.status(400).json({ message: 'Invalid booking ID' });
    }

    if (typeof hotel !== 'string' || typeof booking !== 'string') {
      return res.status(400).json({ message: 'hotel and booking must be ID strings' });
    }
    if (typeof rating !== 'number' || !Number.isFinite(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be a number between 1 and 5' });
    }
    if (typeof comment !== 'string') {
      return res.status(400).json({ message: 'Comment must be a string' });
    }

    const bookingDoc = await Booking.findById(booking);
    if (!bookingDoc) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    if (bookingDoc.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Forbidden: this booking does not belong to you' });
    }

    if (bookingDoc.hotel.toString() !== hotel) {
      return res.status(400).json({ message: 'Booking does not belong to the selected hotel' });
    }

    if (bookingDoc.status !== 'completed') {
      return res.status(400).json({ message: 'You can only review a completed booking' });
    }

    const existingReview = await Review.findOne({ booking });
    if (existingReview) {
      return res.status(400).json({ message: 'A review already exists for this booking' });
    }

    const review = await Review.create({
      user: req.user._id,
      hotel,
      booking,
      rating,
      comment,
    });

    await recalculateHotelRating(hotel);
    await review.populate(FULL_POPULATE);

    return res.status(201).json(review);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'A review already exists for this booking' });
    }
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    return serverError(res, error);
  }
};

// @desc    Get visible reviews for a hotel, newest first
// @route   GET /api/reviews/hotel/:hotelId
// @access  Public
const getHotelReviews = async (req, res) => {
  try {
    const { hotelId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(hotelId)) {
      return res.status(400).json({ message: 'Invalid hotel ID' });
    }

    const hotelDoc = await Hotel.findById(hotelId);
    if (!hotelDoc) {
      return res.status(404).json({ message: 'Hotel not found' });
    }

    const reviews = await Review.find({ hotel: hotelId, status: 'visible' })
      .populate(USER_POPULATE)
      .sort({ createdAt: -1 });

    return res.status(200).json(reviews);
  } catch (error) {
    return serverError(res, error);
  }
};

// @desc    Get a single visible review by ID
// @route   GET /api/reviews/:id
// @access  Public
const getReviewById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid review ID' });
    }

    const review = await Review.findOne({ _id: id, status: 'visible' })
      .populate(USER_POPULATE)
      .populate(HOTEL_POPULATE);

    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    return res.status(200).json(review);
  } catch (error) {
    return serverError(res, error);
  }
};

// @desc    Update a review
//          Owner: can update rating and comment.
//          Admin: can update status (and rating/comment).
// @route   PUT /api/reviews/:id
// @access  Private (owner or admin)
const updateReview = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid review ID' });
    }

    const review = await Review.findById(id);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    const isOwner = review.user.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Forbidden: you can only modify your own review' });
    }

    const { rating, comment, status } = req.body;

    if (rating !== undefined) {
      if (typeof rating !== 'number' || !Number.isFinite(rating) || rating < 1 || rating > 5) {
        return res.status(400).json({ message: 'Rating must be a number between 1 and 5' });
      }
      review.rating = rating;
    }

    if (comment !== undefined) {
      if (typeof comment !== 'string') {
        return res.status(400).json({ message: 'Comment must be a string' });
      }
      review.comment = comment;
    }

    if (status !== undefined) {
      if (!isAdmin) {
        return res.status(403).json({ message: 'Forbidden: only an admin can change review status' });
      }
      if (!['visible', 'hidden'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status value' });
      }
      review.status = status;
    }

    await review.save();
    await recalculateHotelRating(review.hotel);
    await review.populate(FULL_POPULATE);

    return res.status(200).json(review);
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    return serverError(res, error);
  }
};

// @desc    Delete a review
// @route   DELETE /api/reviews/:id
// @access  Private (owner or admin)
const deleteReview = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid review ID' });
    }

    const review = await Review.findById(id);
    if (!review) {
      return res.status(404).json({ message: 'Review not found' });
    }

    const isOwner = review.user.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ message: 'Forbidden: you can only delete your own review' });
    }

    const hotelId = review.hotel;
    await review.deleteOne();
    await recalculateHotelRating(hotelId);

    return res.status(200).json({ message: 'Review deleted successfully' });
  } catch (error) {
    return serverError(res, error);
  }
};

// @desc    Get all reviews (including hidden)
// @route   GET /api/reviews
// @access  Private/Admin
const getAllReviews = async (req, res) => {
  try {
    const reviews = await Review.find()
      .populate(FULL_POPULATE)
      .sort({ createdAt: -1 });

    return res.status(200).json(reviews);
  } catch (error) {
    return serverError(res, error);
  }
};

// @desc    The signed-in user's own reviews (including hidden ones), newest first
// @route   GET /api/reviews/my
// @access  Private
const getMyReviews = async (req, res) => {
  try {
    const reviews = await Review.find({ user: req.user._id })
      .populate([
        { path: 'hotel', select: 'name city country images' },
        { path: 'booking', select: 'checkInDate checkOutDate' },
      ])
      .sort({ createdAt: -1 });

    return res.status(200).json(reviews);
  } catch (error) {
    return serverError(res, error);
  }
};

module.exports = {
  getMyReviews,
  createReview,
  getHotelReviews,
  getReviewById,
  updateReview,
  deleteReview,
  getAllReviews,
};
