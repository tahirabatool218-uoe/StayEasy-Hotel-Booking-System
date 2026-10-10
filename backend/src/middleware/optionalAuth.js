const mongoose = require('mongoose');
const User = require('../models/User');
const generateToken = require('../utils/generateToken');

// Like `protect`, but never rejects. If a valid Bearer token is present,
// req.user is attached; otherwise the request continues as anonymous.
//
// Used on public read routes whose response depends on the caller (admins may
// see hidden hotels and their rooms; everyone else may not). A bad, expired or
// unverifiable token deliberately downgrades to "anonymous" instead of 401, so
// a public page never logs a visitor out (the frontend clears the session on
// any 401) — and any failure keeps hidden data hidden.
const optionalAuth = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    const match = typeof header === 'string' ? /^Bearer\s+(\S+)$/i.exec(header) : null;
    if (match) {
      const decoded = generateToken.verifyToken(match[1]);
      if (typeof decoded.id === 'string' && mongoose.Types.ObjectId.isValid(decoded.id)) {
        const user = await User.findById(decoded.id);
        if (user && user.isActive !== false && !generateToken.isIssuedBeforePasswordChange(decoded, user)) {
          req.user = user;
        }
      }
    }
  } catch (error) {
    // fall through as anonymous
  }
  next();
};

module.exports = optionalAuth;
