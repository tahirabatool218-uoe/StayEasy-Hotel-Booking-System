import api from './api';

// Wraps src/routes/userRoute.js on the backend. Every route acts on the
// authenticated user only (req.user) — never on anyone else's data:
//   GET    /users/profile         -> { _id, name, email, role, profileImage, createdAt, updatedAt }
//   PUT    /users/profile         -> the updated profile (409 when the email is taken);
//                                    body may carry name, email and/or profileImage
//   PUT    /users/change-password -> { message, token }
//   GET    /users/dashboard       -> { user, stats, upcoming[], recentBookings[] }
//   DELETE /users/me              -> { message }  (body: { password })
const getProfile = async () => {
  const { data } = await api.get('/users/profile');
  return data;
};

const updateProfile = async (payload) => {
  const { data } = await api.put('/users/profile', payload);
  return data;
};

// The backend invalidates every token issued before the change and hands back
// a fresh one, so the caller must store it — otherwise the current session
// would be signed out by the very next request.
const changePassword = async ({ currentPassword, newPassword }) => {
  const { data } = await api.put('/users/change-password', { currentPassword, newPassword });
  return data;
};

// stats: { totalBookings, upcomingBookings, pendingBookings, confirmedBookings,
//          completedBookings, cancelledBookings, reviewsWritten, awaitingReview }
// upcoming: next 3 bookings; recentBookings: 5 newest. Both are populated with
// hotel { name city country images } and room { roomNumber roomType }.
const getDashboard = async () => {
  const { data } = await api.get('/users/dashboard');
  return data;
};

// Closes (anonymises + deactivates) the signed-in account. The password goes in
// the JSON body of the authenticated DELETE request (axios needs `data` for
// that), never in the URL or query string. Answers:
//   400 wrong/missing password · 403 admin account · 409 upcoming bookings exist.
// A 400 is used for a wrong password on purpose, so it never signs the user out.
const closeAccount = async (password) => {
  const { data } = await api.delete('/users/me', { data: { password } });
  return data;
};

// Saves (url) or removes (null) the signed-in user's profile picture through the
// same PUT /users/profile endpoint. The server only accepts the caller's own
// Cloudinary avatar URL and answers the updated profile, `profileImage` included.
const updateProfileImage = async (profileImage) => {
  const { data } = await api.put('/users/profile', { profileImage: profileImage || null });
  return data;
};

export default { getProfile, updateProfile, updateProfileImage, changePassword, getDashboard, closeAccount };
