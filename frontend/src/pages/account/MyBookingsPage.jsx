import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import PageHeading from '../../components/account/PageHeading';
import StateBlock from '../../components/account/StateBlock';
import BookingCard from '../../components/bookings/BookingCard';
import CancelBookingDialog from '../../components/bookings/CancelBookingDialog';
import ReviewFormModal from '../../components/reviews/ReviewFormModal';
import EmptyState from '../../components/ui/EmptyState';
import Icon from '../../components/ui/Icon';
import Notice from '../../components/ui/Notice';
import useApiData from '../../hooks/useApiData';
import bookingService from '../../services/bookingService';
import reviewService from '../../services/reviewService';
import { getApiError } from '../../utils/errors';
import { isReviewableStatus } from '../../utils/reviews';

const ERR = "We couldn't load your bookings right now.";

// Bookings + the caller's own reviews (GET /reviews/my, hidden ones included)
// so "Reviewed" is exact. A failed review lookup must not hide the bookings.
const fetchBookingsAndReviews = async () => {
  const [bookings, reviews] = await Promise.all([
    bookingService.getMyBookings(),
    reviewService.getMyReviews().catch(() => []),
  ]);
  return { bookings: bookings || [], reviews };
};

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const idOf = (value) => (value && typeof value === 'object' ? value._id : value);

export default function MyBookingsPage() {
  const { status, data, error, reload, setData } = useApiData(fetchBookingsAndReviews, ERR);
  const [searchParams, setSearchParams] = useSearchParams();
  const filter = FILTERS.some((f) => f.value === searchParams.get('status')) ? searchParams.get('status') : 'all';

  const [bookingToCancel, setBookingToCancel] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);
  const [bookingToReview, setBookingToReview] = useState(null);
  const [feedback, setFeedback] = useState(null);

  const bookings = data?.bookings || [];
  const reviewedIds = new Set((data?.reviews || []).map((r) => idOf(r.booking)));
  const visible = filter === 'all' ? bookings : bookings.filter((b) => b.status === filter);
  const countFor = (value) => (value === 'all' ? bookings.length : bookings.filter((b) => b.status === value).length);

  const handleCancel = async () => {
    if (!bookingToCancel || cancellingId) return;
    const id = bookingToCancel._id;
    setCancellingId(id);
    setFeedback(null);
    try {
      const updated = await bookingService.cancelBooking(id);
      setData((prev) => ({ ...prev, bookings: prev.bookings.map((b) => (b._id === id ? { ...b, ...updated, hotel: updated.hotel || b.hotel, room: updated.room || b.room } : b)) }));
      setFeedback({ type: 'success', text: 'Your booking has been cancelled.' });
    } catch (err) {
      setFeedback({ type: 'error', text: getApiError(err, "We couldn't cancel this booking. Please try again.") });
    } finally {
      setCancellingId(null);
      setBookingToCancel(null);
    }
  };

  const markReviewed = (bookingId, review) =>
    setData((prev) => ({ ...prev, reviews: [...prev.reviews, review || { booking: bookingId }] }));

  const handleReviewSaved = (review) => {
    markReviewed(bookingToReview._id, { ...review, booking: bookingToReview._id });
    setBookingToReview(null);
    setFeedback({ type: 'success', text: 'Thanks! Your review has been published.' });
  };

  const handleReviewDuplicate = () => {
    markReviewed(bookingToReview._id);
    setBookingToReview(null);
    setFeedback({ type: 'error', text: 'This booking has already been reviewed.' });
  };

  return (
    <>
      <PageHeading title="My Bookings" description="Everything you've booked with StayEasy, in one place." />

      <StateBlock status={status} error={error} onRetry={reload} label="Loading your bookings">
        <Notice type={feedback?.type} onDismiss={() => setFeedback(null)}>{feedback?.text}</Notice>

        {bookings.length === 0 ? (
          <EmptyState
            icon={<Icon name="bed" size={26} />}
            title="No bookings yet"
            description="When you book a room, it will show up here."
            action={<Link to="/hotels" className="ui-btn ui-btn-primary"><span className="ui-btn-label">Browse hotels</span></Link>}
          />
        ) : (
          <>
            <div className="filter-chips" role="group" aria-label="Filter bookings by status">
              {FILTERS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  className={`filter-chip ${filter === value ? 'is-active' : ''}`}
                  aria-pressed={filter === value}
                  onClick={() => setSearchParams(value === 'all' ? {} : { status: value })}
                >
                  {label} <span>{countFor(value)}</span>
                </button>
              ))}
            </div>

            {visible.length === 0 ? (
              <EmptyState title="Nothing here" description="You have no bookings with this status." />
            ) : (
              <div className="bookings-list">
                {visible.map((booking) => (
                  <BookingCard
                    key={booking._id}
                    booking={booking}
                    detailsTo={`/account/bookings/${booking._id}`}
                    onCancel={setBookingToCancel}
                    cancelling={cancellingId === booking._id}
                    canReview={isReviewableStatus(booking.status)}
                    reviewed={reviewedIds.has(booking._id)}
                    onReview={setBookingToReview}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </StateBlock>

      <ReviewFormModal
        open={Boolean(bookingToReview)}
        hotelName={bookingToReview?.hotel?.name}
        hotel={bookingToReview?.hotel?._id}
        booking={bookingToReview?._id}
        onClose={() => setBookingToReview(null)}
        onSaved={handleReviewSaved}
        onDuplicate={handleReviewDuplicate}
      />

      <CancelBookingDialog
        booking={bookingToCancel}
        onConfirm={handleCancel}
        onDismiss={() => setBookingToCancel(null)}
        submitting={Boolean(bookingToCancel) && cancellingId === bookingToCancel?._id}
      />
    </>
  );
}
