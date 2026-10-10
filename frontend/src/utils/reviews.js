export const REVIEW_MIN_LENGTH = 10;
export const REVIEW_MAX_LENGTH = 1000;

// The backend only lets the owner review a booking once it is 'completed'
// (createReview in src/controllers/reviewController.js). The UI mirrors that
// so it never offers an action the server would reject; the server stays the
// final authority.
export const isReviewableStatus = (status) => status === 'completed';

// Returns an error string, or '' when the input is acceptable.
export const validateReview = ({ rating, comment }) => {
  if (!rating || rating < 1 || rating > 5) return 'Please choose a star rating from 1 to 5.';
  const trimmed = (comment || '').trim();
  if (!trimmed) return 'Please write a few words about your stay.';
  if (trimmed.length < REVIEW_MIN_LENGTH) {
    return `Your review is a little short — please write at least ${REVIEW_MIN_LENGTH} characters.`;
  }
  if (trimmed.length > REVIEW_MAX_LENGTH) {
    return `Your review is too long — please keep it under ${REVIEW_MAX_LENGTH} characters.`;
  }
  return '';
};

// Backend wording for the duplicate case, see createReview.
export const isDuplicateReviewError = (error) =>
  error?.response?.status === 400 && /already exists/i.test(error?.response?.data?.message || '');

const idOf = (value) => (value && typeof value === 'object' ? value._id : value);

// Public GET /reviews/hotel/:id returns visible reviews with the booking id
// and the reviewer ({ _id, name }). That is the only way the API lets a client
// tell which bookings already have a review.
export const findMyReviewForBooking = (reviews, bookingId, userId) =>
  reviews.find((r) => idOf(r.booking) === bookingId && idOf(r.user) === userId) || null;
