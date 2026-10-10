const express = require('express');
const {
  getProfile,
  updateProfile,
  changePassword,
  getDashboard,
  deleteMyAccount,
} = require('../controllers/userController');
const protect = require('../middleware/authMiddleware');
const { createLoginLimiter } = require('../middleware/security');

const router = express.Router();

// All routes act only on the authenticated user (req.user) — never another user's data
router.get('/profile', protect, getProfile);
router.put('/profile', protect, updateProfile);
// Rate limited like login: a stolen token must not allow unlimited guessing of the current password.
router.get('/dashboard', protect, getDashboard);
router.put('/change-password', protect, createLoginLimiter(), changePassword);
// Rate limited like login: it verifies the password.
router.delete('/me', protect, createLoginLimiter(), deleteMyAccount);

module.exports = router;
