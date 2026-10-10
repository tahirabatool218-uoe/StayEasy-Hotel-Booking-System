const mongoose = require('mongoose');
const User = require('../models/User');
const Hotel = require('../models/Hotel');
const Room = require('../models/Room');
const Booking = require('../models/Booking');
const Review = require('../models/Review');
const { toSafeRegExpTerm } = require('../utils/escapeRegExp');
const { serverError } = require('../utils/httpErrors');

const USER_ROLES = ['user', 'admin'];

// Upper bound on page size for the admin listings, so a client cannot ask for
// the whole collection in one response.
const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 10;

const parsePaging = (page, limit) => {
  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const requested = Math.max(parseInt(limit, 10) || DEFAULT_PAGE_SIZE, 1);
  const limitNum = Math.min(requested, MAX_PAGE_SIZE);
  return { pageNum, limitNum, skip: (pageNum - 1) * limitNum };
};

const BOOKING_POPULATE = [
  { path: 'user', select: 'name email' },
  { path: 'hotel', select: 'name' },
  { path: 'room', select: 'roomNumber roomType' },
];

const REVIEW_POPULATE = [
  { path: 'user', select: 'name' },
  { path: 'hotel', select: 'name' },
];

// Turns [{ _id: 'pending', count: 3 }, ...] into { pending: 3, ... }.
const toCountMap = (groups) =>
  Object.fromEntries((groups || []).map((group) => [group._id, group.count]));

const sumCounts = (counts) => Object.values(counts).reduce((total, n) => total + n, 0);

// "Average rating" on the dashboard = the mean of Hotel.rating over hotels that
// are ACTIVE and have at least one VISIBLE review. Hotel.rating is itself the
// mean of a hotel's visible reviews (recalculateHotelRating), so this is the
// mean of real, review-backed ratings. A hotel without reviews has rating 0 by
// default; counting it would drag the average down with a rating nobody gave,
// and inactive hotels are not shown to guests. Returns
// { averageHotelRating: number|null, ratedHotels: number }.
// "Booked revenue" = the summed totalPrice of CONFIRMED and COMPLETED bookings.
// It is value booked, not money received: the app has no payments.
const getBookedRevenue = async () => {
  const [row] = await Booking.aggregate([
    { $match: { status: { $in: ['confirmed', 'completed'] } } },
    { $group: { _id: null, total: { $sum: '$totalPrice' } } },
  ]);
  return row ? Math.round(row.total * 100) / 100 : 0;
};

const getAverageRatedHotelRating = async () => {
  const [row] = await Review.aggregate([
    { $match: { status: 'visible' } },
    { $group: { _id: '$hotel' } },
    { $lookup: { from: Hotel.collection.name, localField: '_id', foreignField: '_id', as: 'hotel' } },
    { $unwind: '$hotel' },
    { $match: { 'hotel.isActive': true } },
    { $group: { _id: null, avg: { $avg: '$hotel.rating' }, ratedHotels: { $sum: 1 } } },
  ]);

  if (!row) return { averageHotelRating: null, ratedHotels: 0 };
  return { averageHotelRating: Math.round(row.avg * 10) / 10, ratedHotels: row.ratedHotels };
};

// @desc    Get aggregate statistics for the admin dashboard
// @route   GET /api/admin/dashboard
// @access  Private/Admin
const getDashboardStats = async (req, res) => {
  try {
    // Bookings and rooms are each counted by status in ONE aggregation instead
    // of one countDocuments per status; the totals are the sums of the groups.
    // The average rating metric is defined in getAverageRatedHotelRating.
    const [
      totalUsers,
      totalHotels,
      totalReviews,
      bookingStatusCounts,
      roomStatusCounts,
      ratingMetric,
      bookedRevenue,
    ] = await Promise.all([
      User.countDocuments(),
      Hotel.countDocuments(),
      Review.countDocuments(),
      Booking.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Room.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      getAverageRatedHotelRating(),
      getBookedRevenue(),
    ]);

    const bookingsByStatus = toCountMap(bookingStatusCounts);
    const roomsByStatus = toCountMap(roomStatusCounts);

    return res.status(200).json({
      totalUsers,
      totalHotels,
      totalRooms: sumCounts(roomsByStatus),
      totalBookings: sumCounts(bookingsByStatus),
      totalReviews,
      pendingBookings: bookingsByStatus.pending || 0,
      confirmedBookings: bookingsByStatus.confirmed || 0,
      completedBookings: bookingsByStatus.completed || 0,
      cancelledBookings: bookingsByStatus.cancelled || 0,
      availableRooms: roomsByStatus.available || 0,
      maintenanceRooms: roomsByStatus.maintenance || 0,
      inactiveRooms: roomsByStatus.inactive || 0,
      // null (not 0) when no active hotel has a review yet, so the UI cannot
      // present "no data" as a real 0-star average.
      averageHotelRating: ratingMetric.averageHotelRating,
      ratedHotels: ratingMetric.ratedHotels,
      bookedRevenue,
    });
  } catch (error) {
    return serverError(res, error);
  }
};

// @desc    Get the 5 most recent bookings
// @route   GET /api/admin/recent-bookings
// @access  Private/Admin
const getRecentBookings = async (req, res) => {
  try {
    const bookings = await Booking.find()
      .populate(BOOKING_POPULATE)
      .sort({ createdAt: -1 })
      .limit(5);

    return res.status(200).json(bookings);
  } catch (error) {
    return serverError(res, error);
  }
};

// @desc    Get the 5 most recent reviews
// @route   GET /api/admin/recent-reviews
// @access  Private/Admin
const getRecentReviews = async (req, res) => {
  try {
    const reviews = await Review.find()
      .populate(REVIEW_POPULATE)
      .sort({ createdAt: -1 })
      .limit(5);

    return res.status(200).json(reviews);
  } catch (error) {
    return serverError(res, error);
  }
};

// Sorting options for the admin hotel listing. The public listing defaults to
// newest-first; admins additionally want to find a hotel by name.
const HOTEL_SORT_OPTIONS = {
  newest: { createdAt: -1 },
  name_asc: { name: 1 },
  price_asc: { pricePerNight: 1 },
  price_desc: { pricePerNight: -1 },
  rating_desc: { rating: -1 },
};

// @desc    List every hotel, including inactive ones, with filtering and pagination
// @route   GET /api/admin/hotels
// @access  Private/Admin
//
// Deliberately separate from the public GET /api/hotels, which hard-filters
// isActive:true. An admin has to be able to *find* a disabled hotel in order to
// re-enable it, so the public contract is left untouched.
const getAdminHotels = async (req, res) => {
  try {
    const { search, city, country, amenity, isActive, sort, page, limit } = req.query;

    const query = {};

    if (search) {
      const term = toSafeRegExpTerm(search);
      if (term) {
        const regex = new RegExp(term, 'i');
        query.$or = [
          { name: regex },
          { description: regex },
          { location: regex },
          { city: regex },
          { country: regex },
        ];
      }
    }

    if (city) {
      const term = toSafeRegExpTerm(city);
      if (term) query.city = new RegExp(`^${term}$`, 'i');
    }

    if (country) {
      const term = toSafeRegExpTerm(country);
      if (term) query.country = new RegExp(`^${term}$`, 'i');
    }

    if (amenity) {
      const term = toSafeRegExpTerm(amenity);
      if (term) query.amenities = new RegExp(`^${term}$`, 'i');
    }

    if (isActive !== undefined) {
      if (isActive !== 'true' && isActive !== 'false') {
        return res.status(400).json({ message: "isActive must be 'true' or 'false'" });
      }
      query.isActive = isActive === 'true';
    }

    const { pageNum, limitNum, skip } = parsePaging(page, limit);
    const sortOption = HOTEL_SORT_OPTIONS[sort] || { createdAt: -1 };

    const [hotels, total] = await Promise.all([
      Hotel.find(query).sort(sortOption).skip(skip).limit(limitNum),
      Hotel.countDocuments(query),
    ]);

    // One aggregation for the room counts on this page. Hotel.totalRooms is
    // itself kept current by syncHotelRoomCounts whenever a room is created,
    // deleted or moved (utils/roomCounts.js), but the live count is used here
    // as well so a record written before that ran can never show a misleading
    // number.
    const roomCounts = new Map();
    if (hotels.length > 0) {
      const counts = await Room.aggregate([
        { $match: { hotel: { $in: hotels.map((h) => h._id) } } },
        { $group: { _id: '$hotel', count: { $sum: 1 } } },
      ]);
      counts.forEach((c) => roomCounts.set(String(c._id), c.count));
    }

    // `roomCount` and `totalRooms` both carry the live count, so legacy records
    // with a stale stored totalRooms never show a misleading number here.
    const result = hotels.map((hotel) => {
      const liveCount = roomCounts.get(String(hotel._id)) || 0;
      return { ...hotel.toObject(), roomCount: liveCount, totalRooms: liveCount };
    });

    return res.status(200).json({
      hotels: result,
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum) || 0,
    });
  } catch (error) {
    return serverError(res, error);
  }
};

// @desc    List users, with search, role filtering and pagination
// @route   GET /api/admin/users
// @access  Private/Admin
const getUsers = async (req, res) => {
  try {
    const { search, role, page, limit } = req.query;

    const query = {};

    if (search) {
      const term = toSafeRegExpTerm(search);
      if (term) {
        const regex = new RegExp(term, 'i');
        query.$or = [{ name: regex }, { email: regex }];
      }
    }

    if (role) {
      if (!USER_ROLES.includes(role)) {
        return res.status(400).json({ message: `role must be one of: ${USER_ROLES.join(', ')}` });
      }
      query.role = role;
    }

    const { pageNum, limitNum, skip } = parsePaging(page, limit);

    const [users, total] = await Promise.all([
      User.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
      User.countDocuments(query),
    ]);

    // One aggregation for every booking count on the page, rather than N+1
    // countDocuments calls.
    const bookingCounts = new Map();
    if (users.length > 0) {
      const counts = await Booking.aggregate([
        { $match: { user: { $in: users.map((u) => u._id) } } },
        { $group: { _id: '$user', count: { $sum: 1 } } },
      ]);
      counts.forEach((c) => bookingCounts.set(String(c._id), c.count));
    }

    const result = users.map((user) => ({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive !== false,
      closedAt: user.closedAt || null,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      bookingCount: bookingCounts.get(String(user._id)) || 0,
    }));

    return res.status(200).json({
      users: result,
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum) || 0,
    });
  } catch (error) {
    return serverError(res, error);
  }
};

// @desc    Change a user's role
// @route   PUT /api/admin/users/:id/role
// @access  Private/Admin
const updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    const { role } = req.body;
    if (role === undefined) {
      return res.status(400).json({ message: 'Please provide a role' });
    }
    if (!USER_ROLES.includes(role)) {
      return res.status(400).json({ message: `role must be one of: ${USER_ROLES.join(', ')}` });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Guard against locking yourself out of the panel you are standing in.
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'You cannot change your own role' });
    }

    // Guard against removing the only admin, which would leave the admin
    // routes permanently unreachable.
    if (user.role === 'admin' && role === 'user') {
      const adminCount = await User.countDocuments({ role: 'admin' });
      if (adminCount <= 1) {
        return res.status(409).json({ message: 'Cannot demote the last remaining admin' });
      }
    }

    user.role = role;
    // save() rather than findByIdAndUpdate so the model's pre-save hook runs;
    // it returns immediately because the password is untouched.
    await user.save();

    return res.status(200).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    return serverError(res, error);
  }
};

// @desc    Deactivate or reactivate a user
// @route   PUT /api/admin/users/:id/status
// @access  Private/Admin
const updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    const { isActive } = req.body;
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ message: 'isActive must be true or false' });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'You cannot change the status of your own account' });
    }

    if (user.closedAt) {
      return res.status(409).json({ message: 'This account was closed by the guest and cannot be changed' });
    }

    const currentlyActive = user.isActive !== false;
    if (currentlyActive === isActive) {
      return res.status(200).json({
        _id: user._id, name: user.name, email: user.email, role: user.role,
        isActive: currentlyActive, deactivatedAt: user.deactivatedAt || null,
      });
    }

    if (!isActive && user.role === 'admin') {
      const activeAdmins = await User.countDocuments({ role: 'admin', isActive: { $ne: false } });
      if (activeAdmins <= 1) {
        return res.status(409).json({ message: 'Cannot deactivate the last active admin' });
      }
    }

    user.isActive = isActive;
    user.deactivatedAt = isActive ? undefined : new Date();
    await user.save();

    return res.status(200).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      deactivatedAt: user.deactivatedAt || null,
    });
  } catch (error) {
    return serverError(res, error);
  }
};

// @desc    Delete a user
// @route   DELETE /api/admin/users/:id
// @access  Private/Admin
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ message: 'You cannot delete your own account' });
    }

    // Both Booking and Review hold a *required* reference to User, and neither
    // has a cascade rule. Deleting the user would leave those documents
    // pointing at something that no longer exists, so refuse and say why.
    const [bookingCount, reviewCount] = await Promise.all([
      Booking.countDocuments({ user: user._id }),
      Review.countDocuments({ user: user._id }),
    ]);

    if (bookingCount > 0 || reviewCount > 0) {
      return res.status(409).json({
        message:
          `Cannot delete a user with ${bookingCount} booking(s) and ${reviewCount} review(s). ` +
          'Deactivate the account instead: it keeps the history and blocks sign-in.',
      });
    }

    await user.deleteOne();

    return res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    return serverError(res, error);
  }
};

module.exports = {
  getBookedRevenue,
  getAverageRatedHotelRating,
  getDashboardStats,
  getRecentBookings,
  getRecentReviews,
  getAdminHotels,
  getUsers,
  updateUserRole,
  updateUserStatus,
  deleteUser,
};
