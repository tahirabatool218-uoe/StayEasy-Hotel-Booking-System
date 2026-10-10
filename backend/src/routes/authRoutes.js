const express = require('express');
const { registerUser, loginUser, getMe } = require('../controllers/authController');
const protect = require('../middleware/authMiddleware');
const { createLoginLimiter, createRegisterLimiter } = require('../middleware/security');

const router = express.Router();

// Brute-force / account-spam throttles (see middleware/security.js).
router.post('/register', createRegisterLimiter(), registerUser);
router.post('/login', createLoginLimiter(), loginUser);
router.get('/me', protect, getMe);

module.exports = router;
