const mongoose = require('mongoose');
const User = require('../models/User');
const generateToken = require('../utils/generateToken');

// @desc    Protect routes - verify JWT and attach authenticated user to req.user
// @usage   router.get('/some-protected-route', protect, handler)
//
// Only a genuinely bad credential produces a 401: that is the one status the
// frontend treats as "your session is over" and signs the user out for. A
// database hiccup while loading the user is a 503 instead, so a temporary
// outage never logs out someone whose token is perfectly valid.
const protect = async (req, res, next) => {
  const header = req.headers.authorization;
  const match = typeof header === 'string' ? /^Bearer\s+(\S+)$/i.exec(header) : null;

  if (!match) {
    return res.status(401).json({ message: 'Not authorized, no token provided' });
  }

  let decoded;
  try {
    decoded = generateToken.verifyToken(match[1]);
  } catch (error) {
    return res.status(401).json({ message: 'Not authorized, invalid or expired token' });
  }

  if (typeof decoded.id !== 'string' || !mongoose.Types.ObjectId.isValid(decoded.id)) {
    return res.status(401).json({ message: 'Not authorized, invalid or expired token' });
  }

  let user;
  try {
    user = await User.findById(decoded.id);
  } catch (error) {
    console.error('Auth lookup failed:', error);
    return res.status(503).json({ message: 'Service temporarily unavailable, please try again' });
  }

  if (!user) {
    return res.status(401).json({ message: 'Not authorized, user no longer exists' });
  }

  if (user.isActive === false) {
    return res.status(401).json({ message: 'Not authorized, this account has been deactivated' });
  }

  if (generateToken.isIssuedBeforePasswordChange(decoded, user)) {
    return res.status(401).json({ message: 'Not authorized, password was changed. Please sign in again' });
  }

  req.user = user;
  return next();
};

module.exports = protect;
