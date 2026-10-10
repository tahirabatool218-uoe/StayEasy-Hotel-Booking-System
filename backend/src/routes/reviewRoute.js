const express = require('express');
const {
  createReview,
  getHotelReviews,
  getReviewById,
  updateReview,
  deleteReview,
  getAllReviews,
  getMyReviews,
} = require('../controllers/reviewController');
const protect = require('../middleware/authMiddleware');
const authorize = require('../middleware/roleMiddleware');

const router = express.Router();

// Any authenticated user
router.post('/', protect, createReview);

// Admin only
router.get('/', protect, authorize('admin'), getAllReviews);

// The caller's own reviews — must come before /:id
router.get('/my', protect, getMyReviews);

// Public — must come before /:id
router.get('/hotel/:hotelId', getHotelReviews);

// Public
router.get('/:id', getReviewById);

// Owner or admin (enforced inside the controller)
router.put('/:id', protect, updateReview);
router.delete('/:id', protect, deleteReview);

module.exports = router;
