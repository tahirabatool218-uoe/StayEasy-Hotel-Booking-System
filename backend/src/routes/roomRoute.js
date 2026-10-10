const express = require('express');
const {
  createRoom,
  getRooms,
  getRoomById,
  getRoomAvailability,
  updateRoom,
  deleteRoom,
} = require('../controllers/roomController');
const protect = require('../middleware/authMiddleware');
const authorize = require('../middleware/roleMiddleware');
const optionalAuth = require('../middleware/optionalAuth');

const router = express.Router();

// Public routes. optionalAuth lets admins see rooms of hidden hotels; for
// everyone else those rooms are filtered out.
router.get('/', optionalAuth, getRooms);
router.get('/availability', getRoomAvailability); // must come before /:id
router.get('/:id', optionalAuth, getRoomById);

// Admin-only routes
router.post('/', protect, authorize('admin'), createRoom);
router.put('/:id', protect, authorize('admin'), updateRoom);
router.delete('/:id', protect, authorize('admin'), deleteRoom);

module.exports = router;
