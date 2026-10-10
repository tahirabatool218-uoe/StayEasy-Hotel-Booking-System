const express = require('express');
const {
  createHotel,
  getHotels,
  getHotelById,
  updateHotel,
  deleteHotel,
} = require('../controllers/hotelController');
const protect = require('../middleware/authMiddleware');
const authorize = require('../middleware/roleMiddleware');
const optionalAuth = require('../middleware/optionalAuth');

const router = express.Router();

// Public routes. optionalAuth lets admins load a hidden hotel by ID; everyone
// else gets a 404 for it.
router.get('/', getHotels);
router.get('/:id', optionalAuth, getHotelById);

// Admin-only routes
router.post('/', protect, authorize('admin'), createHotel);
router.put('/:id', protect, authorize('admin'), updateHotel);
router.delete('/:id', protect, authorize('admin'), deleteHotel);

module.exports = router;
