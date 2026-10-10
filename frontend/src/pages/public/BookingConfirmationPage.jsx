import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import Icon from '../../components/ui/Icon';
import Spinner from '../../components/ui/Spinner';
import ErrorState from '../../components/ui/ErrorState';
import BookingStatusBadge from '../../components/bookings/BookingStatusBadge';
import bookingService from '../../services/bookingService';
import { calculateNights, formatPrice, formatStayDate } from '../../utils/booking';

export default function BookingConfirmationPage() {
  const { id } = useParams();
  const location = useLocation();

  // Coming straight from BookingPage the booking is already in navigation
  // state, so we can render instantly; on a direct visit or refresh, fall
  // back to GET /api/bookings/:id.
  const [booking, setBooking] = useState(location.state?.booking && location.state.booking._id === id ? location.state.booking : null);
  const [status, setStatus] = useState(booking ? 'ready' : 'loading'); // loading | ready | error | notfound

  const fetchBooking = async () => {
    setStatus('loading');
    try {
      const data = await bookingService.getBookingById(id);
      setBooking(data);
      setStatus('ready');
    } catch (err) {
      setStatus(err?.response?.status === 404 || err?.response?.status === 403 ? 'notfound' : 'error');
    }
  };

  useEffect(() => {
    if (!booking) fetchBooking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (status === 'loading') {
    return (
      <div className="container booking-page-state">
        <Spinner size="lg" label="Loading your booking" />
      </div>
    );
  }

  if (status === 'notfound') {
    return (
      <div className="container booking-page-state">
        <ErrorState
          title="Booking not found"
          description="We couldn't find this booking, or it doesn't belong to your account."
        />
        <div className="confirmation-actions">
          <Link to="/account/bookings" className="ui-btn ui-btn-primary">
            <span className="ui-btn-label">View my bookings</span>
          </Link>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="container booking-page-state">
        <ErrorState description="We couldn't load this booking right now." onRetry={fetchBooking} />
      </div>
    );
  }

  const { hotel, room, checkInDate, checkOutDate, guests, totalPrice, _id } = booking;
  const nights = calculateNights(checkInDate, checkOutDate);

  return (
    <div className="confirmation-page">
      <div className="container confirmation-container">
        <div className="confirmation-hero">
          <div className="confirmation-icon">
            <Icon name="sparkle" size={30} />
          </div>
          <h1>Booking confirmed</h1>
          <p>
            You&apos;re all set at <strong>{hotel?.name}</strong>. We&apos;ve saved your reservation — you can view or
            manage it anytime from My Bookings.
          </p>
        </div>

        <div className="confirmation-card">
          <div className="confirmation-card-header">
            <span className="confirmation-id">Booking #{_id?.slice(-8)}</span>
            <BookingStatusBadge status={booking.status} />
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
          </div>

          <div className="booking-details-total">
            <span>Total price</span>
            <strong>{formatPrice(totalPrice)}</strong>
          </div>
        </div>

        <div className="confirmation-actions">
          <Link to="/account/bookings" className="ui-btn ui-btn-primary">
            <span className="ui-btn-label">View my bookings</span>
          </Link>
          <Link to="/hotels" className="ui-btn ui-btn-outline">
            <span className="ui-btn-label">Back to hotels</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
