import { Link } from 'react-router-dom';
import Icon from '../ui/Icon';
import BookingStatusBadge from './BookingStatusBadge';
import { bookingRef, calculateNights, formatPrice, formatShortDate, formatShortStayDate, isCancellable } from '../../utils/booking';

// booking: a populated Booking document as returned by GET /api/bookings/my
// (see POPULATE_OPTIONS in src/controllers/bookingController.js) — hotel is
// { _id, name, city, country }, room is { _id, roomNumber, roomType }.
// canReview / reviewed are decided by the page (which knows the review data);
// the card only renders them, and only ever for completed bookings.
export default function BookingCard({ booking, onViewDetails, onCancel, cancelling = false, canReview = false, reviewed = false, onReview, detailsTo }) {
  const { hotel, room, checkInDate, checkOutDate, guests, totalPrice, status, _id, createdAt } = booking;
  const nights = calculateNights(checkInDate, checkOutDate);

  return (
    <div className="booking-card">
      <div className="booking-card-header">
        <div>
          <h3>{hotel?.name || 'Hotel'}</h3>
          <p className="booking-card-location">
            <Icon name="pin" size={14} />
            {hotel?.city}
            {hotel?.country ? `, ${hotel.country}` : ''}
          </p>
        </div>
        <BookingStatusBadge status={status} />
      </div>

      <div className="booking-card-body">
        <div className="booking-card-detail">
          <span className="booking-card-detail-label">
            <Icon name="calendar" size={14} /> Dates
          </span>
          <span>
            {formatShortStayDate(checkInDate)} – {formatShortStayDate(checkOutDate)}
          </span>
          <span className="booking-card-detail-sub">
            {nights} {nights === 1 ? 'night' : 'nights'}
          </span>
        </div>

        <div className="booking-card-detail">
          <span className="booking-card-detail-label">
            <Icon name="bed" size={14} /> Room
          </span>
          <span>{room?.roomType || 'Room'}</span>
          {room?.roomNumber && <span className="booking-card-detail-sub">Room {room.roomNumber}</span>}
        </div>

        <div className="booking-card-detail">
          <span className="booking-card-detail-label">
            <Icon name="guests" size={14} /> Guests
          </span>
          <span>{guests}</span>
        </div>

        <div className="booking-card-detail">
          <span className="booking-card-detail-label">Total</span>
          <span className="booking-card-price">{formatPrice(totalPrice)}</span>
        </div>
      </div>

      <div className="booking-card-footer">
        <span className="booking-card-id">
          Booking {bookingRef(_id)}
          {createdAt && <span className="booking-card-created"> · Booked {formatShortDate(createdAt)}</span>}
        </span>

        <div className="booking-card-actions">
          {detailsTo ? (
            <Link to={detailsTo} className="ui-btn ui-btn-outline ui-btn-sm">
              <span className="ui-btn-label">View details</span>
            </Link>
          ) : (
            <button type="button" className="ui-btn ui-btn-outline ui-btn-sm" onClick={() => onViewDetails(booking)}>
              <span className="ui-btn-label">View details</span>
            </button>
          )}

          {status === 'completed' && reviewed && (
            <>
              <span className="booking-reviewed">
                <Icon name="check" size={14} /> Reviewed
              </span>
              {hotel?._id && (
                <Link to="/account/reviews" className="ui-btn ui-btn-outline ui-btn-sm">
                  <span className="ui-btn-label">View review</span>
                </Link>
              )}
            </>
          )}

          {status === 'completed' && canReview && !reviewed && (
            <button type="button" className="ui-btn ui-btn-primary ui-btn-sm" onClick={() => onReview(booking)}>
              <span className="ui-btn-label">Write a Review</span>
            </button>
          )}

          {isCancellable(status) && (
            <button
              type="button"
              className="ui-btn ui-btn-danger ui-btn-sm"
              onClick={() => onCancel(booking)}
              disabled={cancelling}
              aria-busy={cancelling}
            >
              <span className="ui-btn-label">{cancelling ? 'Cancelling…' : 'Cancel'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
