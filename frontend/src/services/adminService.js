import api from './api';

// Wraps the admin-only routes in src/routes/adminRoute.js. Every call here
// requires an 'admin' role, so a 403 here means the session lost admin rights
// (the api interceptor already logs the user out on a 401).
//
//   GET    /admin/dashboard        -> counts for the dashboard tiles; averageHotelRating is the
//                                     mean rating of active hotels that have visible reviews
//                                     (null when there are none), ratedHotels is how many
//   GET    /admin/recent-bookings  -> Booking[] (5 newest)
//   GET    /admin/recent-reviews   -> Review[] (5 newest)
//   GET    /admin/hotels           -> { hotels[], page, limit, total, totalPages }
//   GET    /admin/users            -> { users[], page, limit, total, totalPages }
//   PUT    /admin/users/:id/role   -> the updated user
//   PUT    /admin/users/:id/status -> { _id, name, email, role, isActive, deactivatedAt }

// Axios would send `?isActive=` for an empty filter, which the backend rejects
// rather than reading as "no filter". Dropping empties keeps optional filters
// genuinely optional.
const omitEmpty = (params) =>
  Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== ''));

const getDashboardStats = async () => {
  const { data } = await api.get('/admin/dashboard');
  return data;
};

const getRecentBookings = async () => {
  const { data } = await api.get('/admin/recent-bookings');
  return data || [];
};

const getRecentReviews = async () => {
  const { data } = await api.get('/admin/recent-reviews');
  return data || [];
};

// params: { search, city, country, amenity, isActive: 'true' | 'false', sort, page, limit }
// Unlike the public GET /hotels, this also returns inactive hotels, so a
// disabled listing can still be found and switched back on.
const getHotels = async (params = {}) => {
  const { data } = await api.get('/admin/hotels', { params: omitEmpty(params) });
  return data;
};

// params: { search, role, page, limit }
const getUsers = async (params = {}) => {
  const { data } = await api.get('/admin/users', { params: omitEmpty(params) });
  return data;
};

// The backend refuses this for your own account, and for the last admin.
const updateUserRole = async (id, role) => {
  const { data } = await api.put(`/admin/users/${id}/role`, { role });
  return data;
};

// Deactivate / reactivate. The backend refuses it for your own account (400),
// for a closed account and for the last active admin (409). Hard deletion is
// intentionally not exposed: users with bookings or reviews cannot be deleted.
const updateUserStatus = async (id, isActive) => {
  const { data } = await api.put(`/admin/users/${id}/status`, { isActive });
  return data;
};

export default {
  getDashboardStats,
  getRecentBookings,
  getRecentReviews,
  getHotels,
  getUsers,
  updateUserRole,
  updateUserStatus,
};
