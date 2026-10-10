import { Link } from 'react-router-dom';
import BookingStatusBadge from '../bookings/BookingStatusBadge';
import Icon from '../ui/Icon';
import { bookingRef, calculateNights, formatPrice, formatShortStayDate } from '../../utils/booking';

// Compact booking line used on the dashboard (upcoming + recent).
export default function BookingRow({ booking }) {
  const { hotel, room, checkInDate, checkOutDate, totalPrice, status, _id } = booking;
  const nights = calculateNights(checkInDate, checkOutDate);
  const image = hotel?.images?.[0];

  return (
    <li>
      <Link to={`/account/bookings/${_id}`} className="booking-row">
        <span className="booking-row-thumb">
          {image ? <img src={image} alt="" loading="lazy" /> : <Icon name="building" size={22} />}
        </span>
        <span className="booking-row-main">
          <strong>{hotel?.name || 'Hotel'}</strong>
          <span>
            {formatShortStayDate(checkInDate)} – {formatShortStayDate(checkOutDate)} · {nights} {nights === 1 ? 'night' : 'nights'}
            {room?.roomType ? ` · ${room.roomType}` : ''}
          </span>
          <span className="booking-row-ref">{bookingRef(_id)}</span>
        </span>
        <span className="booking-row-side">
          <BookingStatusBadge status={status} />
          <strong>{formatPrice(totalPrice)}</strong>
        </span>
      </Link>
    </li>
  );
}
