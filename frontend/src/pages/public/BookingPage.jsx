import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import Icon from '../../components/ui/Icon';
import Button from '../../components/ui/Button';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import hotelService from '../../services/hotelService';
import roomService from '../../services/roomService';
import bookingService from '../../services/bookingService';
import { calculateNights, formatPrice, formatStayDate } from '../../utils/booking';

const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;

// Reads and validates the booking context carried from HotelDetailsPage
// (see handleContinueBooking there). Everything is passed via the URL so
// the flow survives a login redirect and a page refresh without touching
// localStorage.
const readBookingParams = (searchParams) => {
  const hotelId = searchParams.get('hotel') || '';
  const roomId = searchParams.get('room') || '';
  const checkIn = searchParams.get('checkIn') || '';
  const checkOut = searchParams.get('checkOut') || '';
  const guestsRaw = searchParams.get('guests') || '';
  const guests = Number(guestsRaw);

  const isValid =
    OBJECT_ID_RE.test(hotelId) &&
    OBJECT_ID_RE.test(roomId) &&
    Boolean(checkIn) &&
    Boolean(checkOut) &&
    checkOut > checkIn &&
    guestsRaw !== '' &&
    Number.isFinite(guests) &&
    guests >= 1;

  return { hotelId, roomId, checkIn, checkOut, guests, isValid };
};

const CONFLICT_MESSAGE =
  'This room is no longer available for the selected dates. Please choose another room or update your dates.';

export default function BookingPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();

  const { hotelId, roomId, checkIn, checkOut, guests, isValid } = readBookingParams(searchParams);

  const [status, setStatus] = useState(isValid ? 'loading' : 'invalid'); // invalid | loading | ready | notfound | error
  const [hotel, setHotel] = useState(null);
  const [room, setRoom] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null); // { type, message }

  // Bumped by the retry button. The effect below depends on it so a retry
  // actually re-runs the fetch — merely setting `status` back to 'loading'
  // would leave the effect deps untouched and spin forever.
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    if (!isValid) {
      setStatus('invalid');
      return undefined;
    }

    let cancelled = false;
    setStatus('loading');

    (async () => {
      try {
        const [hotelData, roomData] = await Promise.all([
          hotelService.getHotelById(hotelId),
          roomService.getRoomById(roomId),
        ]);
        if (cancelled) return;
        setHotel(hotelData);
        setRoom(roomData);
        setStatus('ready');
      } catch (err) {
        if (cancelled) return;
        setStatus(err?.response?.status === 404 ? 'notfound' : 'error');
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotelId, roomId, isValid, retryNonce]);

  const retry = () => {
    if (isValid) setRetryNonce((n) => n + 1);
  };

  if (status === 'invalid') {
    return (
      <div className="container booking-page-state">
        <EmptyState
          icon={<Icon name="compass" size={26} />}
          title="We're missing some booking details"
          description="It looks like this booking link is incomplete. Head back to a hotel to choose your dates, guests and room again."
          action={
            <Link to="/hotels" className="ui-btn ui-btn-primary">
              <span className="ui-btn-label">Browse hotels</span>
            </Link>
          }
        />
      </div>
    );
  }

  if (status === 'loading') {
    return (
      <div className="container booking-page-state">
        <Spinner size="lg" label="Preparing your booking" />
      </div>
    );
  }

  if (status === 'notfound') {
    return (
      <div className="container booking-page-state">
        <EmptyState
          icon={<Icon name="bed" size={26} />}
          title="Hotel or room not found"
          description="This hotel or room may no longer be available. Please choose another room."
          action={
            <Link to="/hotels" className="ui-btn ui-btn-primary">
              <span className="ui-btn-label">Browse hotels</span>
            </Link>
          }
        />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="container booking-page-state">
        <ErrorState description="We couldn't load your booking details right now." onRetry={retry} />
      </div>
    );
  }

  const nights = calculateNights(checkIn, checkOut);
  const estimatedTotal = room.pricePerNight * nights;
  const capacityExceeded = guests > room.capacity;
  const roomUnavailable = room.status !== 'available';
  const hotelMismatch = room.hotel && (room.hotel._id || room.hotel).toString() !== hotelId;
  const canConfirm = !capacityExceeded && !roomUnavailable && !hotelMismatch && !submitting;

  const changeSearchParams = new URLSearchParams({ checkIn, checkOut, guests: String(guests) }).toString();

  const handleConfirm = async () => {
    if (!canConfirm || submitting) return;
    setSubmitting(true);
    setSubmitError(null);

    try {
      const booking = await bookingService.createBooking({
        hotel: hotelId,
        room: roomId,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        guests,
      });
      navigate(`/booking/confirmation/${booking._id}`, { replace: true, state: { booking } });
    } catch (err) {
      const responseStatus = err?.response?.status;
      const message = err?.response?.data?.message;

      if (responseStatus === 409) {
        setSubmitError({ type: 'conflict', message: message || CONFLICT_MESSAGE });
      } else if (responseStatus === 401) {
        navigate('/login', { state: { from: location } });
      } else if (responseStatus === 400) {
        setSubmitError({ type: 'validation', message: message || 'Please check your booking details and try again.' });
      } else {
        setSubmitError({ type: 'server', message: "We couldn't complete your booking. Please try again." });
      }
      setSubmitting(false);
    }
  };

  return (
    <div className="booking-page">
      <div className="container">
        <Link to={`/hotels/${hotelId}?${changeSearchParams}`} className="booking-back-link">
          <Icon name="chevronLeft" size={16} /> Back to {hotel.name}
        </Link>

        <div className="booking-header">
          <h1>Confirm your booking</h1>
          <p>Review the details below before you confirm.</p>
        </div>

        <div className="booking-grid">
          <div className="booking-main">
            {roomUnavailable && (
              <div className="warning-banner" role="alert">
                This room is currently marked as {room.status} and can&apos;t be booked. Please choose another room.
              </div>
            )}
            {!roomUnavailable && capacityExceeded && (
              <div className="warning-banner" role="alert">
                This room sleeps up to {room.capacity} {room.capacity === 1 ? 'guest' : 'guests'}, which is fewer
                than the {guests} guests you selected. Please choose a larger room or reduce your guest count.
              </div>
            )}

            <section className="booking-info-card">
              <h2>{hotel.name}</h2>
              <p className="booking-info-location">
                <Icon name="pin" size={14} /> {hotel.city}
                {hotel.country ? `, ${hotel.country}` : ''}
              </p>

              <div className="booking-room-summary">
                <div>
                  <h3>{room.roomType}</h3>
                  <span className="booking-room-number">Room {room.roomNumber}</span>
                </div>
                <span className="booking-room-price">
                  {formatPrice(room.pricePerNight)} <span>/ night</span>
                </span>
              </div>
              {room.description && <p className="booking-room-description">{room.description}</p>}
            </section>

            <section className="booking-info-card">
              <h2>Your stay</h2>
              <div className="stay-detail-grid">
                <div className="stay-detail">
                  <span className="stay-detail-label">
                    <Icon name="calendar" size={14} /> Check-in
                  </span>
                  <span>{formatStayDate(checkIn)}</span>
                </div>
                <div className="stay-detail">
                  <span className="stay-detail-label">
                    <Icon name="calendar" size={14} /> Check-out
                  </span>
                  <span>{formatStayDate(checkOut)}</span>
                </div>
                <div className="stay-detail">
                  <span className="stay-detail-label">Length of stay</span>
                  <span>
                    {nights} {nights === 1 ? 'night' : 'nights'}
                  </span>
                </div>
                <div className="stay-detail">
                  <span className="stay-detail-label">
                    <Icon name="guests" size={14} /> Guests
                  </span>
                  <span>{guests}</span>
                </div>
              </div>
              <Link to={`/hotels/${hotelId}?${changeSearchParams}`} className="booking-change-link">
                Change dates or guests
              </Link>
            </section>
          </div>

          <aside className="booking-summary-sidebar">
            <div className="booking-summary-card">
              <h3>Price summary</h3>

              <div className="booking-summary-row">
                <span>
                  {formatPrice(room.pricePerNight)} × {nights} {nights === 1 ? 'night' : 'nights'}
                </span>
                <span>{formatPrice(estimatedTotal)}</span>
              </div>

              <div className="booking-summary-total">
                <span>Estimated total</span>
                <strong>{formatPrice(estimatedTotal)}</strong>
              </div>
              <p className="booking-summary-note">The exact total is confirmed by the hotel when your booking is created.</p>

              {submitError && (
                <div className="error-banner" role="alert">
                  {submitError.message}
                  {submitError.type === 'conflict' && (
                    <Link to={`/hotels/${hotelId}?${changeSearchParams}`} className="error-banner-link">
                      Choose another room
                    </Link>
                  )}
                </div>
              )}

              <Button
                variant="primary"
                size="lg"
                fullWidth
                loading={submitting}
                disabled={!canConfirm}
                onClick={handleConfirm}
              >
                Confirm booking
              </Button>

              <p className="booking-summary-hint">You&apos;ll get a confirmation as soon as this is booked.</p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
