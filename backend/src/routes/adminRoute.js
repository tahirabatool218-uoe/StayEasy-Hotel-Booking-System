const express = require('express');
const {
  getDashboardStats,
  getRecentBookings,
  getRecentReviews,
  getAdminHotels,
  getUsers,
  updateUserRole,
  updateUserStatus,
  deleteUser,
} = require('../controllers/adminController');
const protect = require('../middleware/authMiddleware');
const authorize = require('../middleware/roleMiddleware');

const router = express.Router();

// All admin routes are protected and restricted to the 'admin' role
router.get('/dashboard', protect, authorize('admin'), getDashboardStats);
router.get('/recent-bookings', protect, authorize('admin'), getRecentBookings);
router.get('/recent-reviews', protect, authorize('admin'), getRecentReviews);

// Hotel management. Separate from the public GET /api/hotels, which only ever
// returns active hotels.
router.get('/hotels', protect, authorize('admin'), getAdminHotels);

// User management
router.get('/users', protect, authorize('admin'), getUsers);
router.put('/users/:id/role', protect, authorize('admin'), updateUserRole);
router.put('/users/:id/status', protect, authorize('admin'), updateUserStatus);
router.delete('/users/:id', protect, authorize('admin'), deleteUser);

module.exports = router;
