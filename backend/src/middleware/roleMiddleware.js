// @desc    Restrict access to specific user roles
// @usage   router.get('/admin-only', protect, authorize('admin'), handler)
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authorized, no user context' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Forbidden: insufficient role permissions' });
    }

    next();
  };
};

module.exports = authorize;
