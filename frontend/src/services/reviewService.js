import api from './api';

// Wraps src/routes/reviewRoute.js on the backend:
//   GET    /reviews            -> Review[] including hidden ones (admin only)
//   GET    /reviews/my         -> the caller's own Review[] (hidden ones included), hotel + booking populated
//   GET    /reviews/hotel/:id  -> Review[] visible only, newest first (public)
//   POST   /reviews            -> Review (only for a completed booking you own)
//   PUT    /reviews/:id        -> Review (owner may edit rating/comment; only an
//                                 admin may send { status: 'visible' | 'hidden' })
//   DELETE /reviews/:id        -> { message }
//
// The hotel's average rating is recalculated server-side on every create, edit,
// hide and delete, so the frontend never has to send or adjust a rating.

const getAllReviews = async () => {
  const { data } = await api.get('/reviews');
  return data || [];
};

const getMyReviews = async () => {
  const { data } = await api.get('/reviews/my');
  return data || [];
};

const getHotelReviews = async (hotelId) => {
  const { data } = await api.get(`/reviews/hotel/${hotelId}`);
  return data || [];
};

const createReview = async ({ hotel, booking, rating, comment }) => {
  const { data } = await api.post('/reviews', { hotel, booking, rating, comment });
  return data;
};

const updateReview = async (id, payload) => {
  const { data } = await api.put(`/reviews/${id}`, payload);
  return data;
};

// Moderation shortcut: hiding a review immediately drops it out of the public
// hotel page because getHotelReviews filters on status: 'visible'.
const setReviewStatus = async (id, status) => {
  const { data } = await api.put(`/reviews/${id}`, { status });
  return data;
};

const deleteReview = async (id) => {
  const { data } = await api.delete(`/reviews/${id}`);
  return data;
};

export default { getAllReviews, getMyReviews, getHotelReviews, createReview, updateReview, setReviewStatus, deleteReview };
