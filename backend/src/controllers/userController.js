const crypto = require('crypto');
const User = require('../models/User');
const Booking = require('../models/Booking');
const Review = require('../models/Review');
const { getToday } = require('../utils/bookingValidation');
const generateToken = require('../utils/generateToken');
const { serverError } = require('../utils/httpErrors');
const { validateProfileImage } = require('../utils/profileImage');
const {
  validateName,
  validateEmail,
  validateNewPassword,
  validateExistingPassword,
} = require('../utils/validators');

// @desc    Get the authenticated user's own profile
// @route   GET /api/users/profile
// @access  Private
const getProfile = async (req, res) => {
  try {
    // req.user is attached by the `protect` middleware and already excludes
    // the password field (User.password has `select: false`).
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.status(200).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      profileImage: user.profileImage || '',
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  } catch (error) {
    return serverError(res, error);
  }
};

// @desc    Update the authenticated user's own name/email/profile image
// @route   PUT /api/users/profile
// @access  Private
const updateProfile = async (req, res) => {
  try {
    const { name, email, profileImage } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // profileImage: a Cloudinary URL of THIS user's own avatar to set it, or
    // null / '' to remove it. Validated before anything is changed.
    if (profileImage !== undefined) {
      const parsedImage = validateProfileImage(profileImage, user._id);
      if (parsedImage.error) {
        return res.status(parsedImage.status).json({ message: parsedImage.error });
      }
      user.profileImage = parsedImage.value;
    }

    if (name !== undefined) {
      const parsedName = validateName(name);
      if (parsedName.error) {
        return res.status(400).json({ message: parsedName.error });
      }
      user.name = parsedName.value;
    }

    if (email !== undefined) {
      const parsedEmail = validateEmail(email);
      if (parsedEmail.error) {
        return res.status(400).json({ message: parsedEmail.error });
      }

      if (parsedEmail.value !== user.email) {
        const emailTaken = await User.findOne({ email: parsedEmail.value });
        if (emailTaken) {
          return res.status(409).json({ message: 'Email is already in use' });
        }
        user.email = parsedEmail.value;
      }
    }

    // role and password are intentionally never touched here, regardless of
    // what the client sends — only name/email/profileImage are read from req.body above.
    await user.save();

    return res.status(200).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      profileImage: user.profileImage || '',
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Email is already in use' });
    }
    return serverError(res, error);
  }
};

// @desc    Change the authenticated user's own password
// @route   PUT /api/users/change-password
// @access  Private
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (currentPassword === undefined || newPassword === undefined) {
      return res.status(400).json({ message: 'Please provide currentPassword and newPassword' });
    }

    const parsedCurrent = validateExistingPassword(currentPassword);
    if (parsedCurrent.error) {
      return res.status(400).json({ message: 'Please provide your current password' });
    }
    const parsedNew = validateNewPassword(newPassword);
    if (parsedNew.error) {
      return res.status(400).json({ message: parsedNew.error.replace(/^Password/, 'New password') });
    }

    // password has `select: false` on the model, so it must be explicitly requested
    const user = await User.findById(req.user._id).select('+password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isMatch = await user.matchPassword(parsedCurrent.value);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    // Assigning triggers the model's pre('save') hook, which hashes the
    // password with bcrypt before persisting it — never stored in plain text.
    user.password = parsedNew.value;
    await user.save();

    // Saving stamped passwordChangedAt, which invalidates every token issued
    // before now (including the caller's). Hand back a fresh one — an additive
    // field, so existing clients that ignore it still work — so the current
    // session can carry on without a forced sign-in.
    return res.status(200).json({
      message: 'Password updated successfully',
      token: generateToken(user._id),
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    return serverError(res, error);
  }
};

const BOOKING_POPULATE = [
  { path: 'hotel', select: 'name city country images' },
  { path: 'room', select: 'roomNumber roomType' },
];

// A booking that still matters to the guest: not cancelled or completed, and
// the stay has not ended yet (checking out today counts as ended).
const upcomingFilter = (userId) => ({
  user: userId,
  status: { $in: ['pending', 'confirmed'] },
  checkOutDate: { $gt: getToday() },
});

// @desc    Summary for the signed-in user's dashboard
// @route   GET /api/users/dashboard
// @access  Private
//
// Plain counts and finds only (no $lookup/$avg), all scoped to req.user.
const getDashboard = async (req, res) => {
  try {
    const userId = req.user._id;

    const [statusGroups, upcomingCount, upcoming, recent, reviewsWritten, completed, reviewed] =
      await Promise.all([
        Booking.aggregate([
          { $match: { user: userId } },
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ]),
        Booking.countDocuments(upcomingFilter(userId)),
        Booking.find(upcomingFilter(userId)).sort({ checkInDate: 1 }).limit(3).populate(BOOKING_POPULATE),
        Booking.find({ user: userId }).sort({ createdAt: -1 }).limit(5).populate(BOOKING_POPULATE),
        Review.countDocuments({ user: userId }),
        Booking.find({ user: userId, status: 'completed' }).select('_id').lean(),
        Review.find({ user: userId }).select('booking').lean(),
      ]);

    const byStatus = Object.fromEntries(statusGroups.map((g) => [g._id, g.count]));
    const reviewedIds = new Set(reviewed.map((r) => String(r.booking)));
    const awaitingReview = completed.filter((b) => !reviewedIds.has(String(b._id))).length;
    const totalBookings = Object.values(byStatus).reduce((sum, n) => sum + n, 0);

    return res.status(200).json({
      user: {
        _id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        profileImage: req.user.profileImage || '',
        createdAt: req.user.createdAt,
      },
      stats: {
        totalBookings,
        upcomingBookings: upcomingCount,
        pendingBookings: byStatus.pending || 0,
        confirmedBookings: byStatus.confirmed || 0,
        completedBookings: byStatus.completed || 0,
        cancelledBookings: byStatus.cancelled || 0,
        reviewsWritten,
        awaitingReview,
      },
      upcoming,
      recentBookings: recent,
    });
  } catch (error) {
    return serverError(res, error);
  }
};

// @desc    Close the signed-in user's own account
// @route   DELETE /api/users/me
// @access  Private
//
// The account is anonymised, not deleted: bookings and reviews reference the
// user and the hotel's records must stay intact. The name becomes "Guest", the
// email is replaced by an unusable address, the password by a random one, and
// the account is deactivated (which also invalidates every issued token).
const deleteMyAccount = async (req, res) => {
  try {
    const { password } = req.body;

    const parsedPassword = validateExistingPassword(password);
    if (parsedPassword.error) {
      return res.status(400).json({ message: 'Please provide your password to close your account' });
    }

    const user = await User.findById(req.user._id).select('+password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user.role === 'admin') {
      return res.status(403).json({ message: 'Admin accounts cannot be closed here' });
    }

    // 400, not 401: the frontend treats 401 as "session over" and signs out.
    if (!(await user.matchPassword(parsedPassword.value))) {
      return res.status(400).json({ message: 'Password is incorrect' });
    }

    const upcoming = await Booking.countDocuments(upcomingFilter(user._id));
    if (upcoming > 0) {
      return res.status(409).json({
        message: `You have ${upcoming} upcoming booking(s). Cancel them before closing your account.`,
      });
    }

    const now = new Date();
    user.name = 'Guest';
    user.email = `closed-${user._id}@closed.stayeasy.invalid`;
    user.password = crypto.randomBytes(32).toString('hex'); // hashed by the pre-save hook
    user.isActive = false;
    user.deactivatedAt = now;
    user.closedAt = now;
    user.profileImage = '';
    await user.save();

    return res.status(200).json({ message: 'Your account has been closed' });
  } catch (error) {
    return serverError(res, error);
  }
};

module.exports = { getProfile, updateProfile, changePassword, getDashboard, deleteMyAccount };
