import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import Icon from '../../components/ui/Icon';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import BookingCard from '../../components/bookings/BookingCard';
import BookingDetailsModal from '../../components/bookings/BookingDetailsModal';
import CancelBookingDialog from '../../components/bookings/CancelBookingDialog';
import ReviewFormModal from '../../components/reviews/ReviewFormModal';
import bookingService from '../../services/bookingService';
import reviewService from '../../services/reviewService';
import { findMyReviewForBooking, isReviewableStatus } from '../../utils/reviews';

export default function MyBookingsPage() {
  const [status, setStatus] = useState('loading'); // loading | success | empty | error
  const [bookings, setBookings] = useState([]);

  const [selectedBooking, setSelectedBooking] = useState(null); // details modal
  const [bookingToCancel, setBookingToCancel] = useState(null); // confirm dialog
  const [cancellingId, setCancellingId] = useState(null);
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', message }

  const { user } = useAuth();
  // ids of bookings known to have a visible review by this user. The API has
  // no "my reviews" endpoint, so this is derived from each hotel's public list.
  const [reviewedIds, setReviewedIds] = useState(() => new Set());
  const [bookingToReview, setBookingToReview] = useState(null);

  const loadReviewedBookings = async (list) => {
    const completed = list.filter((b) => isReviewableStatus(b.status) && b.hotel?._id);
    const hotelIds = [...new Set(completed.map((b) => b.hotel._id))];
    if (hotelIds.length === 0 || !user?._id) return;

    const results = await Promise.allSettled(hotelIds.map((id) => reviewService.getHotelReviews(id)));
    const reviewed = new Set();
    completed.forEach((b) => {
      const idx = hotelIds.indexOf(b.hotel._id);
      const result = results[idx];
      if (result.status === 'fulfilled' && findMyReviewForBooking(result.value, b._id, user._id)) {
        reviewed.add(b._id);
      }
    });
    setReviewedIds(reviewed);
  };

  const fetchBookings = async () => {
    setStatus('loading');
    try {
      const data = await bookingService.getMyBookings();
      setBookings(data || []);
      setStatus((data || []).length > 0 ? 'success' : 'empty');
      loadReviewedBookings(data || []);
    } catch {
      setStatus('error');
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const handleCancel = async () => {
    if (!bookingToCancel) return;
    const id = bookingToCancel._id;
    setCancellingId(id);
    setFeedback(null);

    try {
      const updated = await bookingService.cancelBooking(id);
      setBookings((prev) => prev.map((b) => (b._id === id ? updated : b)));
      setSelectedBooking((prev) => (prev && prev._id === id ? updated : prev));
      setFeedback({ type: 'success', message: 'Your booking has been cancelled.' });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err?.response?.data?.message || "We couldn't cancel this booking. Please try again.",
      });
    } finally {
      setCancellingId(null);
      setBookingToCancel(null);
    }
  };

  const handleReviewSaved = () => {
    setReviewedIds((prev) => new Set(prev).add(bookingToReview._id));
    setBookingToReview(null);
    setFeedback({ type: 'success', message: 'Thanks! Your review has been published.' });
  };

  // The backend says it already exists (e.g. a hidden review the public list
  // can't show us) — treat it as reviewed.
  const handleReviewDuplicate = () => {
    setReviewedIds((prev) => new Set(prev).add(bookingToReview._id));
    setBookingToReview(null);
    setFeedback({ type: 'error', message: 'This booking has already been reviewed.' });
  };

  if (status === 'loading') {
    return (
      <div className="booking-page-state">
        <Spinner size="lg" label="Loading your bookings" />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="booking-page-state">
        <ErrorState description="We couldn't load your bookings right now." onRetry={fetchBookings} />
      </div>
    );
  }

  return (
    <div className="my-bookings-page">
      <div className="my-bookings-header">
        <h1>My bookings</h1>
        <p>Everything you&apos;ve booked with StayEasy, in one place.</p>
      </div>

      {feedback && (
        <div className={feedback.type === 'success' ? 'success-banner' : 'error-banner'} role="alert">
          {feedback.message}
        </div>
      )}

      {status === 'empty' ? (
        <EmptyState
          icon={<Icon name="bed" size={26} />}
          title="No bookings yet"
          description="When you book a room, it will show up here."
          action={
            <Link to="/hotels" className="ui-btn ui-btn-primary">
              <span className="ui-btn-label">Browse hotels</span>
            </Link>
          }
        />
      ) : (
        <div className="bookings-list">
          {bookings.map((booking) => (
            <BookingCard
              key={booking._id}
              booking={booking}
              onViewDetails={setSelectedBooking}
              onCancel={setBookingToCancel}
              cancelling={cancellingId === booking._id}
              canReview={isReviewableStatus(booking.status)}
              reviewed={reviewedIds.has(booking._id)}
              onReview={setBookingToReview}
            />
          ))}
        </div>
      )}

      <BookingDetailsModal
        booking={selectedBooking}
        onClose={() => setSelectedBooking(null)}
        onCancel={(booking) => {
          setSelectedBooking(null);
          setBookingToCancel(booking);
        }}
        cancelling={Boolean(selectedBooking) && cancellingId === selectedBooking?._id}
      />

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
    </div>
  );
}
