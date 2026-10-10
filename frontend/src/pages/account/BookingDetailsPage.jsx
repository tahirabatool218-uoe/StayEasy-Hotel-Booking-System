import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import PageHeading from '../../components/account/PageHeading';
import StateBlock from '../../components/account/StateBlock';
import BookingStatusBadge from '../../components/bookings/BookingStatusBadge';
import CancelBookingDialog from '../../components/bookings/CancelBookingDialog';
import ReviewFormModal from '../../components/reviews/ReviewFormModal';
import Notice from '../../components/ui/Notice';
import useApiData from '../../hooks/useApiData';
import bookingService from '../../services/bookingService';
import reviewService from '../../services/reviewService';
import { bookingRef, calculateNights, formatDate, formatPrice, formatStayDate, isCancellable } from '../../utils/booking';
import { getApiError } from '../../utils/errors';
import { isReviewableStatus } from '../../utils/reviews';

const ERR = 'We could not load this booking.';
const idOf = (value) => (value && typeof value === 'object' ? value._id : value);

export default function BookingDetailsPage() {
  const { id } = useParams();
  // The API only returns a booking to its owner (or an admin); anything else is
  // a 403/404, which is shown as "not found" rather than leaking its existence.
  const fetcher = useCallback(async () => {
    const [booking, reviews] = await Promise.all([
      bookingService.getBookingById(id),
      reviewService.getMyReviews().catch(() => []),
    ]);
    return { booking, reviews };
  }, [id]);
  const { status, data, error, reload, setData } = useApiData(fetcher, ERR);

  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const booking = data?.booking;
  const reviewed = Boolean(booking && data.reviews.some((r) => idOf(r.booking) === booking._id));

  const handleCancel = async () => {
    if (cancelling) return;
    setCancelling(true);
    setFeedback(null);
    try {
      const updated = await bookingService.cancelBooking(booking._id);
      setData((prev) => ({ ...prev, booking: { ...prev.booking, ...updated, hotel: updated.hotel || prev.booking.hotel, room: updated.room || prev.booking.room } }));
      setFeedback({ type: 'success', text: 'Your booking has been cancelled.' });
    } catch (err) {
      setFeedback({ type: 'error', text: getApiError(err, "We couldn't cancel this booking. Please try again.") });
    } finally {
      setCancelling(false);
      setConfirmCancel(false);
    }
  };

  const markReviewed = (review) => {
    setData((prev) => ({ ...prev, reviews: [...prev.reviews, review || { booking: prev.booking._id }] }));
    setReviewing(false);
  };

  const { hotel, room } = booking || {};
  const nights = booking ? calculateNights(booking.checkInDate, booking.checkOutDate) : 0;
  const rows = booking
    ? [
        ['Hotel', hotel?.name || 'Hotel'],
        ['Location', [hotel?.city, hotel?.country].filter(Boolean).join(', ') || '—'],
        ['Room', `${room?.roomType || 'Room'}${room?.roomNumber ? ` · Room ${room.roomNumber}` : ''}`],
        ['Check-in', formatStayDate(booking.checkInDate)],
        ['Check-out', formatStayDate(booking.checkOutDate)],
        ['Length of stay', `${nights} ${nights === 1 ? 'night' : 'nights'}`],
        ['Guests', booking.guests],
        ['Booked on', booking.createdAt ? formatDate(booking.createdAt) : '—'],
      ]
    : [];

  return (
    <>
      <nav className="account-crumbs" aria-label="Breadcrumb">
        <Link to="/account/bookings">My Bookings</Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{booking ? bookingRef(booking._id) : 'Booking'}</span>
      </nav>

      <StateBlock
        status={status}
        error={error && /not found|not authorized|invalid/i.test(error) ? 'This booking could not be found, or it belongs to another account.' : error}
        onRetry={reload}
        label="Loading booking"
      >
        {booking && (
          <>
            <PageHeading title={hotel?.name || 'Booking details'} description={`Booking reference ${bookingRef(booking._id)}`}>
              <BookingStatusBadge status={booking.status} />
            </PageHeading>

            <Notice type={feedback?.type} onDismiss={() => setFeedback(null)}>{feedback?.text}</Notice>

            <section className="card acct-section">
              <dl className="detail-list">
                {rows.map(([label, value]) => (
                  <div key={label} className="detail-row">
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
              <div className="booking-details-total">
                <span>Total price</span>
                <strong>{formatPrice(booking.totalPrice)}</strong>
              </div>
            </section>

            <div className="form-actions">
              {hotel?._id && (
                <Link to={`/hotels/${hotel._id}`} className="ui-btn ui-btn-outline">
                  <span className="ui-btn-label">View hotel</span>
                </Link>
              )}
              {isReviewableStatus(booking.status) && (reviewed ? (
                <Link to="/account/reviews" className="ui-btn ui-btn-outline"><span className="ui-btn-label">View your review</span></Link>
              ) : (
                <button type="button" className="ui-btn ui-btn-primary" onClick={() => setReviewing(true)}>
                  <span className="ui-btn-label">Write a review</span>
                </button>
              ))}
              {isCancellable(booking.status) && (
                <button type="button" className="ui-btn ui-btn-danger" onClick={() => setConfirmCancel(true)} disabled={cancelling}>
                  <span className="ui-btn-label">Cancel booking</span>
                </button>
              )}
            </div>
          </>
        )}
      </StateBlock>

      <CancelBookingDialog booking={confirmCancel ? booking : null} onConfirm={handleCancel} onDismiss={() => setConfirmCancel(false)} submitting={cancelling} />
      <ReviewFormModal
        open={reviewing}
        hotelName={hotel?.name}
        hotel={hotel?._id}
        booking={booking?._id}
        onClose={() => setReviewing(false)}
        onSaved={(review) => { markReviewed({ ...review, booking: booking._id }); setFeedback({ type: 'success', text: 'Thanks! Your review has been published.' }); }}
        onDuplicate={() => { markReviewed(); setFeedback({ type: 'error', text: 'This booking has already been reviewed.' }); }}
      />
    </>
  );
}
