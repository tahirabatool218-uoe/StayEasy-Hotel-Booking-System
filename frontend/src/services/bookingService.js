import api from './api';

// Wraps src/routes/bookingRoute.js on the backend:
//   POST /bookings      -> Booking (populated: user{name email}, hotel{name city country}, room{roomNumber roomType})
//   GET  /bookings/my   -> Booking[] for the authenticated user
//   GET  /bookings/:id  -> Booking (owner or admin only)
//   PUT  /bookings/:id  -> Booking (owner may only send { status: 'cancelled' }; admin may send more fields)
// The backend always derives totalPrice from the room's real price — the
// frontend never sends totalPrice and only ever displays what comes back.
const createBooking = async ({ hotel, room, checkInDate, checkOutDate, guests }) => {
  const { data } = await api.post('/bookings', { hotel, room, checkInDate, checkOutDate, guests });
  return data;
};

const getMyBookings = async () => {
  const { data } = await api.get('/bookings/my');
  return data;
};

const getBookingById = async (id) => {
  const { data } = await api.get(`/bookings/${id}`);
  return data;
};

// The backend rejects anything else from a non-admin caller, so this is
// intentionally the only mutation exposed here for regular users.
const cancelBooking = async (id) => {
  const { data } = await api.put(`/bookings/${id}`, { status: 'cancelled' });
  return data;
};

// Admin-only. The backend whitelists status / guests / checkInDate /
// checkOutDate, re-validates the range and recomputes totalPrice from the
// room's real price, so a client-supplied totalPrice is always ignored.
const getAllBookings = async () => {
  const { data } = await api.get('/bookings');
  return data || [];
};

const updateBooking = async (id, payload) => {
  const { data } = await api.put(`/bookings/${id}`, payload);
  return data;
};

const deleteBooking = async (id) => {
  const { data } = await api.delete(`/bookings/${id}`);
  return data;
};

export default {
  createBooking,
  getMyBookings,
  getBookingById,
  cancelBooking,
  getAllBookings,
  updateBooking,
  deleteBooking,
};
