const express = require('express');
const {
  createBooking,
  getMyBookings,
  getAllBookings,
  getBookingById,
  updateBooking,
  deleteBooking,
} = require('../controllers/bookingController');
const protect = require('../middleware/authMiddleware');
const authorize = require('../middleware/roleMiddleware');

const router = express.Router();

// Any authenticated user
router.post('/', protect, createBooking);
router.get('/my', protect, getMyBookings); // must come before /:id

// Admin only
router.get('/', protect, authorize('admin'), getAllBookings);
router.delete('/:id', protect, authorize('admin'), deleteBooking);

// Owner or admin (enforced inside the controller)
router.get('/:id', protect, getBookingById);
router.put('/:id', protect, updateBooking);

module.exports = router;
