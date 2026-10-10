import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import ConfirmDialog from '../admin/ConfirmDialog';
import Button from '../ui/Button';
import EmptyState from '../ui/EmptyState';
import ErrorState from '../ui/ErrorState';
import Icon from '../ui/Icon';
import Spinner from '../ui/Spinner';
import ReviewFormModal from './ReviewFormModal';
import StarRating from './StarRating';
import { useAuth } from '../../context/AuthContext';
import reviewService from '../../services/reviewService';
import bookingService from '../../services/bookingService';
import hotelService from '../../services/hotelService';
import { formatShortDate } from '../../utils/booking';
import { getApiError } from '../../utils/errors';
import { findMyReviewForBooking, isReviewableStatus } from '../../utils/reviews';

// Reviews block for the Hotel Details page. All data comes from the API:
//   GET /reviews/hotel/:id  (visible reviews)      GET /hotels/:id (rating)
//   GET /bookings/my        (to find an eligible completed booking)
export default function ReviewsSection({ hotelId, hotelName, rating: initialRating = 0, onRatingChange }) {
  const { user, isAuthenticated, isAdmin } = useAuth();
  const location = useLocation();

  const [reviews, setReviews] = useState([]);
  const [status, setStatus] = useState('loading'); // loading | success | empty | error
  const [rating, setRating] = useState(initialRating);
  const [eligibleBooking, setEligibleBooking] = useState(null);

  const [formState, setFormState] = useState(null); // { review? } when open
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const userId = user?._id;

  const load = useCallback(async () => {
    try {
      const list = await reviewService.getHotelReviews(hotelId);
      setReviews(list);
      setStatus(list.length > 0 ? 'success' : 'empty');
      return list;
    } catch {
      setStatus('error');
      return null;
    }
  }, [hotelId]);

  // The rating is recalculated by the backend on every change, so re-read it
  // from the hotel rather than computing anything client-side.
  const refreshRating = useCallback(async () => {
    try {
      const hotel = await hotelService.getHotelById(hotelId);
      setRating(hotel.rating || 0);
      onRatingChange?.(hotel.rating || 0);
    } catch {
      /* keep the previous rating; the reviews list is still accurate */
    }
  }, [hotelId, onRatingChange]);

  const findEligibleBooking = useCallback(
    async (list) => {
      if (!isAuthenticated || isAdmin || !userId) {
        setEligibleBooking(null);
        return;
      }
      try {
        const bookings = await bookingService.getMyBookings();
        const match = (bookings || []).find(
          (b) =>
            b.hotel?._id === hotelId &&
            isReviewableStatus(b.status) &&
            !findMyReviewForBooking(list, b._id, userId)
        );
        setEligibleBooking(match || null);
      } catch {
        setEligibleBooking(null);
      }
    },
    [hotelId, isAuthenticated, isAdmin, userId]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStatus('loading');
      const list = await load();
      if (!cancelled && list) await findEligibleBooking(list);
    })();
    return () => {
      cancelled = true;
    };
  }, [load, findEligibleBooking]);

  // Deep link from My Bookings ("/hotels/:id#reviews").
  useEffect(() => {
    if (status !== 'loading' && location.hash === '#reviews') {
      document.getElementById('reviews')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [status, location.hash]);

  const reload = async () => {
    const list = await load();
    await refreshRating();
    if (list) await findEligibleBooking(list);
  };

  const handleSaved = async (_saved, mode) => {
    setFormState(null);
    setFeedback({
      type: 'success',
      message: mode === 'edit' ? 'Your review has been updated.' : 'Thanks! Your review has been published.',
    });
    await reload();
  };

  const handleDuplicate = async () => {
    setFormState(null);
    setFeedback({ type: 'error', message: 'This booking has already been reviewed.' });
    await reload();
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await reviewService.deleteReview(toDelete._id);
      setToDelete(null);
      setFeedback({ type: 'success', message: 'Your review has been deleted.' });
      await reload();
    } catch (err) {
      setToDelete(null);
      setFeedback({ type: 'error', message: getApiError(err, "We couldn't delete your review. Please try again.") });
    } finally {
      setDeleting(false);
    }
  };

  const count = reviews.length;
  const average = useMemo(() => (rating > 0 ? rating.toFixed(1) : null), [rating]);

  return (
    <section className="hotel-detail-section reviews-section" id="reviews">
      <div className="reviews-header">
        <div className="reviews-summary">
          <h2>Guest reviews</h2>
          {status !== 'loading' && status !== 'error' && (
            <div className="reviews-overall">
              {average ? (
                <>
                  <span className="reviews-score">{average}</span>
                  <div>
                    <StarRating value={rating} size={18} />
                    <span className="reviews-count">
                      {count} {count === 1 ? 'review' : 'reviews'}
                    </span>
                  </div>
                </>
              ) : (
                <span className="reviews-count">No ratings yet</span>
              )}
            </div>
          )}
        </div>

        {eligibleBooking && (
          <Button onClick={() => setFormState({})}>
            <Icon name="star" size={16} /> Write a Review
          </Button>
        )}
      </div>

      {feedback && (
        <div className={feedback.type === 'success' ? 'success-banner' : 'error-banner'} role="alert">
          {feedback.message}
        </div>
      )}

      {status === 'loading' && (
        <div className="section-loading">
          <Spinner size="lg" label="Loading reviews" />
        </div>
      )}

      {status === 'error' && (
        <ErrorState description="We couldn't load the reviews for this hotel right now." onRetry={reload} />
      )}

      {status === 'empty' && (
        <EmptyState
          icon={<Icon name="star" size={26} />}
          title="No reviews yet"
          description="Be the first to share your experience after your stay."
          action={
            !isAuthenticated ? (
              <Link to="/login" state={{ from: location }} className="ui-btn ui-btn-outline">
                <span className="ui-btn-label">Log in to review</span>
              </Link>
            ) : undefined
          }
        />
      )}

      {status === 'success' && (
        <ul className="review-list">
          {reviews.map((review) => {
            const mine = Boolean(userId) && review.user?._id === userId;
            return (
              <li className="review-card" key={review._id}>
                <div className="review-card-top">
                  <div className="review-avatar" aria-hidden="true">
                    {(review.user?.name || 'G').charAt(0).toUpperCase()}
                  </div>
                  <div className="review-meta">
                    <strong>{review.user?.name || 'Guest'}</strong>
                    <span>{formatShortDate(review.createdAt)}</span>
                  </div>
                  <StarRating value={review.rating} size={16} />
                </div>
                <p className="review-text">{review.comment}</p>
                {mine && (
                  <div className="review-actions">
                    <button
                      type="button"
                      className="ui-btn ui-btn-outline ui-btn-sm"
                      onClick={() => setFormState({ review })}
                    >
                      <span className="ui-btn-label">Edit</span>
                    </button>
                    <button type="button" className="ui-btn ui-btn-danger ui-btn-sm" onClick={() => setToDelete(review)}>
                      <span className="ui-btn-label">Delete</span>
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <ReviewFormModal
        open={Boolean(formState)}
        hotelName={hotelName}
        hotel={hotelId}
        booking={eligibleBooking?._id}
        review={formState?.review}
        onClose={() => setFormState(null)}
        onSaved={handleSaved}
        onDuplicate={handleDuplicate}
      />

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Delete your review?"
        description="Your review will be removed and the hotel's rating will be updated. This can't be undone."
        confirmLabel="Yes, delete review"
        submitting={deleting}
        onConfirm={handleDelete}
        onDismiss={() => setToDelete(null)}
      />
    </section>
  );
}
