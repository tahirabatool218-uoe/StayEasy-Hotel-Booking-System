const jwt = require('jsonwebtoken');

// The algorithm is pinned on both sign and verify. Without a pinned list on
// verify, a token using a different algorithm (including "none" in old
// libraries) would be judged by the token's own header instead of ours.
const ALGORITHM = 'HS256';

const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    algorithm: ALGORITHM,
    expiresIn: process.env.JWT_EXPIRES_IN || '30d',
  });
};

// Throws a jsonwebtoken error (JsonWebTokenError / TokenExpiredError) if the
// token is malformed, expired, signed with another key or another algorithm.
generateToken.verifyToken = (token) => jwt.verify(token, process.env.JWT_SECRET, { algorithms: [ALGORITHM] });

// A token issued before the user last changed their password is no longer
// valid. `iat` is in whole seconds, so compare at second granularity.
generateToken.isIssuedBeforePasswordChange = (decoded, user) => {
  if (!user.passwordChangedAt || typeof decoded.iat !== 'number') return false;
  return decoded.iat < Math.floor(user.passwordChangedAt.getTime() / 1000);
};

module.exports = generateToken;
