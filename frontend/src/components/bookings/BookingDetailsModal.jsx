import { useEffect } from 'react';
import Icon from '../ui/Icon';
import BookingStatusBadge from './BookingStatusBadge';
import { bookingRef, calculateNights, formatDate, formatPrice, formatStayDate, isCancellable } from '../../utils/booking';

export default function BookingDetailsModal({ booking, onClose, onCancel, cancelling = false }) {
  useEffect(() => {
    if (!booking) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [booking, onClose]);

  if (!booking) return null;

  const { hotel, room, checkInDate, checkOutDate, guests, totalPrice, status, _id, createdAt } = booking;
  const nights = calculateNights(checkInDate, checkOutDate);

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="modal modal-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-details-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3 id="booking-details-title">Booking details</h3>
          <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>
            <Icon name="close" size={18} />
          </button>
        </div>

        <div className="booking-details-status">
          <BookingStatusBadge status={status} />
          <span className="booking-details-id">Booking {bookingRef(_id)}</span>
        </div>

        <div className="booking-details-grid">
          <div className="booking-details-row">
            <span className="booking-details-label">Hotel</span>
            <span>{hotel?.name}</span>
          </div>
          <div className="booking-details-row">
            <span className="booking-details-label">Location</span>
            <span>
              {hotel?.city}
              {hotel?.country ? `, ${hotel.country}` : ''}
            </span>
          </div>
          <div className="booking-details-row">
            <span className="booking-details-label">Room</span>
            <span>
              {room?.roomType}
              {room?.roomNumber ? ` · Room ${room.roomNumber}` : ''}
            </span>
          </div>
          <div className="booking-details-row">
            <span className="booking-details-label">Check-in</span>
            <span>{formatStayDate(checkInDate)}</span>
          </div>
          <div className="booking-details-row">
            <span className="booking-details-label">Check-out</span>
            <span>{formatStayDate(checkOutDate)}</span>
          </div>
          <div className="booking-details-row">
            <span className="booking-details-label">Length of stay</span>
            <span>
              {nights} {nights === 1 ? 'night' : 'nights'}
            </span>
          </div>
          <div className="booking-details-row">
            <span className="booking-details-label">Guests</span>
            <span>{guests}</span>
          </div>
          {createdAt && (
            <div className="booking-details-row">
              <span className="booking-details-label">Booked on</span>
              <span>{formatDate(createdAt)}</span>
            </div>
          )}
        </div>

        <div className="booking-details-total">
          <span>Total price</span>
          <strong>{formatPrice(totalPrice)}</strong>
        </div>

        <div className="modal-actions">
          <button type="button" className="ui-btn ui-btn-outline" onClick={onClose}>
            <span className="ui-btn-label">Close</span>
          </button>
          {isCancellable(status) && (
            <button
              type="button"
              className="ui-btn ui-btn-danger"
              onClick={() => onCancel(booking)}
              disabled={cancelling}
            >
              <span className="ui-btn-label">Cancel booking</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
