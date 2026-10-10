const express = require('express');
const { getUploadSignature } = require('../controllers/uploadController');
const protect = require('../middleware/authMiddleware');
const authorize = require('../middleware/roleMiddleware');

const router = express.Router();

const adminOnly = authorize('admin');

// Any signed-in user may request an *avatar* signature (the controller scopes
// it to their own asset). Hotel/room image signatures stay admin-only, exactly
// as before.
const avatarOrAdmin = (req, res, next) => {
  if (req.body && req.body.purpose === 'avatar') return next();
  return adminOnly(req, res, next);
};

router.post('/signature', protect, avatarOrAdmin, getUploadSignature);

module.exports = router;
