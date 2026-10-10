const mongoose = require('mongoose');
const Hotel = require('../models/Hotel');
const Room = require('../models/Room');
const Booking = require('../models/Booking');
const Review = require('../models/Review');
const { toSafeRegExpTerm } = require('../utils/escapeRegExp');
const { serverError } = require('../utils/httpErrors');
const { validateImageUrls } = require('../utils/validators');

// Fields a client is allowed to set/update on a hotel.
// isActive is intentionally included so admins can soft-disable a listing.
//
// `rating` and `totalRooms` are deliberately NOT here. `rating` is derived from
// visible reviews by recalculateHotelRating in reviewController, so a client
// value would be overwritten by (or fight with) the next review. `totalRooms`
// is a stored counter that the room controller recomputes whenever a room is
// created, deleted or moved (utils/roomCounts.js); the admin list additionally
// reports the live count. Sending either field is ignored, like any other
// unknown field.
const ALLOWED_FIELDS = [
  'name',
  'description',
  'location',
  'city',
  'country',
  'address',
  'pricePerNight',
  'amenities',
  'images',
  'isActive',
];

const pickAllowedFields = (body) => {
  const data = {};
  for (const field of ALLOWED_FIELDS) {
    if (body[field] !== undefined) {
      data[field] = body[field];
    }
  }
  return data;
};

// @desc    Create a new hotel
// @route   POST /api/hotels
// @access  Private/Admin
const createHotel = async (req, res) => {
  try {
    const {
      name,
      description,
      location,
      city,
      country,
      address,
      pricePerNight,
    } = req.body;

    if (!name || !description || !location || !city || !country || !address || pricePerNight === undefined) {
      return res.status(400).json({
        message: 'Please provide name, description, location, city, country, address and pricePerNight',
      });
    }

    const hotelData = pickAllowedFields(req.body);
    if (hotelData.images !== undefined) {
      const parsedImages = validateImageUrls(hotelData.images);
      if (parsedImages.error) return res.status(400).json({ message: parsedImages.error });
      hotelData.images = parsedImages.value;
    }
    const hotel = await Hotel.create(hotelData);

    return res.status(201).json(hotel);
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    return serverError(res, error);
  }
};

// Maps the public `sort` query value to a Mongoose sort object.
// Falls back to the existing default (newest first) for any unknown value.
const SORT_OPTIONS = {
  price_asc: { pricePerNight: 1 },
  price_desc: { pricePerNight: -1 },
  rating_desc: { rating: -1 },
  newest: { createdAt: -1 },
};

// @desc    Get active hotels, with optional search, filtering, sorting and pagination
// @route   GET /api/hotels
// @access  Public
const getHotels = async (req, res) => {
  try {
    const {
      search,
      city,
      country,
      minPrice,
      maxPrice,
      minRating,
      amenity,
      sort,
      page,
      limit,
    } = req.query;

    const query = { isActive: true };

    // Case-insensitive text search across relevant fields.
    // All terms are escaped so user input is matched literally, which
    // prevents both a crash on characters like "(" and ReDoS patterns.
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

    if (minPrice !== undefined || maxPrice !== undefined) {
      query.pricePerNight = {};
      if (minPrice !== undefined) {
        const min = Number(minPrice);
        if (Number.isNaN(min)) {
          return res.status(400).json({ message: 'minPrice must be a number' });
        }
        query.pricePerNight.$gte = min;
      }
      if (maxPrice !== undefined) {
        const max = Number(maxPrice);
        if (Number.isNaN(max)) {
          return res.status(400).json({ message: 'maxPrice must be a number' });
        }
        query.pricePerNight.$lte = max;
      }
    }

    if (minRating !== undefined) {
      const min = Number(minRating);
      if (Number.isNaN(min)) {
        return res.status(400).json({ message: 'minRating must be a number' });
      }
      query.rating = { $gte: min };
    }

    if (amenity) {
      const term = toSafeRegExpTerm(amenity);
      if (term) query.amenities = new RegExp(`^${term}$`, 'i');
    }

    const sortOption = SORT_OPTIONS[sort] || { createdAt: -1 };

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const limitNum = Math.max(parseInt(limit, 10) || 10, 1);
    const skip = (pageNum - 1) * limitNum;

    const [hotels, total] = await Promise.all([
      Hotel.find(query).sort(sortOption).skip(skip).limit(limitNum),
      Hotel.countDocuments(query),
    ]);

    return res.status(200).json({
      hotels,
      page: pageNum,
      limit: limitNum,
      total,
      totalPages: Math.ceil(total / limitNum) || 0,
    });
  } catch (error) {
    return serverError(res, error);
  }
};

// @desc    Get a single hotel by ID (hidden hotels: admins only)
// @route   GET /api/hotels/:id
// @access  Public (optional auth)
const getHotelById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid hotel ID' });
    }

    const hotel = await Hotel.findById(id);
    // A hidden hotel is indistinguishable from a missing one for everyone but
    // admins (req.user is set by optionalAuth), so its ID leaks nothing.
    if (!hotel || (!hotel.isActive && req.user?.role !== 'admin')) {
      return res.status(404).json({ message: 'Hotel not found' });
    }

    return res.status(200).json(hotel);
  } catch (error) {
    return serverError(res, error);
  }
};

// @desc    Update a hotel
// @route   PUT /api/hotels/:id
// @access  Private/Admin
const updateHotel = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid hotel ID' });
    }

    const updateData = pickAllowedFields(req.body);
    if (updateData.images !== undefined) {
      const parsedImages = validateImageUrls(updateData.images);
      if (parsedImages.error) return res.status(400).json({ message: parsedImages.error });
      updateData.images = parsedImages.value;
    }

    const hotel = await Hotel.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!hotel) {
      return res.status(404).json({ message: 'Hotel not found' });
    }

    return res.status(200).json(hotel);
  } catch (error) {
    if (error.name === 'ValidationError') {
      return res.status(400).json({ message: error.message });
    }
    return serverError(res, error);
  }
};

// @desc    Delete a hotel
// @route   DELETE /api/hotels/:id
// @access  Private/Admin
const deleteHotel = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid hotel ID' });
    }

    const hotel = await Hotel.findById(id);
    if (!hotel) {
      return res.status(404).json({ message: 'Hotel not found' });
    }

    // Bookings, reviews and rooms all hold a *required* reference to the hotel
    // and nothing cascades, so deleting it would leave them pointing at a
    // missing hotel. Refuse, and point at the non-destructive alternative
    // (hiding the hotel via isActive). Nothing is deleted on the admin's behalf.
    const [bookingCount, reviewCount, roomCount] = await Promise.all([
      Booking.countDocuments({ hotel: hotel._id }),
      Review.countDocuments({ hotel: hotel._id }),
      Room.countDocuments({ hotel: hotel._id }),
    ]);

    if (bookingCount > 0 || reviewCount > 0) {
      return res.status(409).json({
        message:
          `Cannot delete this hotel: it has ${bookingCount} booking(s) and ${reviewCount} review(s) on record. ` +
          'To take it off the public site, edit the hotel and untick "Visible on the public site" instead.',
      });
    }

    if (roomCount > 0) {
      return res.status(409).json({
        message:
          `Cannot delete this hotel: it still has ${roomCount} room(s). ` +
          'Delete or move its rooms first, or hide the hotel from the public site instead.',
      });
    }

    await hotel.deleteOne();

    return res.status(200).json({ message: 'Hotel deleted successfully' });
  } catch (error) {
    return serverError(res, error);
  }
};

module.exports = {
  createHotel,
  getHotels,
  getHotelById,
  updateHotel,
  deleteHotel,
};
