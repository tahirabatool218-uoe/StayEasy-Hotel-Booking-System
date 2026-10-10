import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import ImageGallery from '../../components/hotels/ImageGallery';
import RoomAvailabilityForm from '../../components/rooms/RoomAvailabilityForm';
import RoomCard from '../../components/rooms/RoomCard';
import ReviewsSection from '../../components/reviews/ReviewsSection';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import Icon from '../../components/ui/Icon';
import Notice from '../../components/ui/Notice';
import { useAuth } from '../../context/AuthContext';
import hotelService from '../../services/hotelService';
import roomService from '../../services/roomService';

export default function HotelDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [hotel, setHotel] = useState(null);
  const [hotelStatus, setHotelStatus] = useState('loading'); // loading | success | error | notfound

  // All bookable rooms belonging to this hotel, independent of any dates.
  // Shown by default so the page is never empty just because the visitor
  // hasn't picked dates yet.
  const [hotelRooms, setHotelRooms] = useState([]);
  const [hotelRoomsStatus, setHotelRoomsStatus] = useState('loading'); // loading | success | empty | error

  // Date-filtered result of GET /api/rooms/availability. Kept separate from
  // hotelRooms: this list only exists once the visitor has run a search.
  const [availableRooms, setAvailableRooms] = useState([]);
  const [availabilityStatus, setAvailabilityStatus] = useState('idle'); // idle | loading | success | empty | error
  const [searchedRange, setSearchedRange] = useState(null);

  const fetchHotel = async () => {
    setHotelStatus('loading');
    try {
      const data = await hotelService.getHotelById(id);
      setHotel(data);
      setHotelStatus('success');
    } catch (err) {
      setHotelStatus(err?.response?.status === 404 ? 'notfound' : 'error');
    }
  };

  // The hotel's own rooms — no dates involved. Only 'available' rooms are
  // requested so internal statuses (maintenance/inactive) stay admin-only.
  const fetchHotelRooms = async () => {
    setHotelRoomsStatus('loading');
    try {
      const data = await roomService.getRooms({ hotel: id, status: 'available' });
      const list = Array.isArray(data) ? data : [];
      setHotelRooms(list);
      setHotelRoomsStatus(list.length > 0 ? 'success' : 'empty');
    } catch {
      setHotelRoomsStatus('error');
    }
  };

  useEffect(() => {
    fetchHotel();
    fetchHotelRooms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleAvailabilitySearch = async ({ checkInDate, checkOutDate, guests }) => {
    setAvailabilityStatus('loading');

    // Keep the chosen dates/guests shareable and restorable on refresh —
    // and available to HotelCard links if the person navigates back.
    const next = new URLSearchParams(searchParams);
    next.set('checkIn', checkInDate);
    next.set('checkOut', checkOutDate);
    next.set('guests', String(guests));
    setSearchParams(next, { replace: true });

    try {
      const data = await roomService.getAvailability({ hotel: id, checkInDate, checkOutDate, guests });
      setAvailableRooms(data || []);
      setSearchedRange({ checkInDate, checkOutDate, guests });
      setAvailabilityStatus((data || []).length > 0 ? 'success' : 'empty');
    } catch {
      setAvailabilityStatus('error');
    }
  };

  // Returns to the unfiltered "our rooms" view, e.g. after a search finds
  // nothing or the visitor wants to browse everything again.
  const resetAvailabilitySearch = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('checkIn');
    next.delete('checkOut');
    next.delete('guests');
    setSearchParams(next, { replace: true });
    setAvailableRooms([]);
    setSearchedRange(null);
    setAvailabilityStatus('idle');
  };

  // If dates/guests were already chosen on the hotels list or homepage,
  // run the availability search automatically once the hotel has loaded.
  useEffect(() => {
    if (hotelStatus !== 'success') return;
    const ci = searchParams.get('checkIn');
    const co = searchParams.get('checkOut');
    if (ci && co) {
      handleAvailabilitySearch({ checkInDate: ci, checkOutDate: co, guests: Number(searchParams.get('guests')) || 1 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotelStatus]);

  // Reviews change the hotel's server-side average; keep the header badge in sync.
  const handleRatingChange = useCallback((next) => {
    setHotel((prev) => (prev ? { ...prev, rating: next } : prev));
  }, []);

  const { isAdmin } = useAuth();
  const [adminNotice, setAdminNotice] = useState('');

  const handleContinueBooking = (room) => {
    // Admins manage StayEasy from the Admin Panel; bookings are a guest feature.
    if (isAdmin) {
      setAdminNotice('You are signed in as an administrator. Sign in with a guest account to make a booking.');
      return;
    }
    // Hands off to the booking flow (src/pages/public/BookingPage.jsx) with
    // everything it needs carried as query params, so the selection survives
    // a login redirect or a page refresh without touching localStorage.
    const params = new URLSearchParams({
      hotel: id,
      room: room._id,
      checkIn: searchedRange?.checkInDate || '',
      checkOut: searchedRange?.checkOutDate || '',
      guests: String(searchedRange?.guests || ''),
    });
    navigate(`/booking?${params.toString()}`);
  };

  if (hotelStatus === 'loading') {
    return (
      <div className="container hotel-detail-loading">
        <Spinner size="lg" label="Loading hotel" />
      </div>
    );
  }

  if (hotelStatus === 'notfound') {
    return (
      <div className="container hotel-detail-state">
        <EmptyState
          icon={<Icon name="compass" size={26} />}
          title="Hotel not found"
          description="This hotel may have been removed, or the link you followed is incorrect."
        />
      </div>
    );
  }

  if (hotelStatus === 'error') {
    return (
      <div className="container hotel-detail-state">
        <ErrorState description="We couldn't load this hotel right now." onRetry={fetchHotel} />
      </div>
    );
  }

  const { name, description, city, country, address, location, rating, images = [], amenities = [] } = hotel;

  return (
    <div className="hotel-detail">
      <div className="container">
        <div className="hotel-detail-header">
          <div>
            <h1>{name}</h1>
            <p className="hotel-detail-location">
              <Icon name="pin" size={15} />
              {location ? `${location}, ` : ''}
              {city}, {country}
            </p>
          </div>
          {rating > 0 && (
            <span className="hotel-detail-rating">
              <Icon name="star" size={16} /> {rating.toFixed(1)}
            </span>
          )}
        </div>

        <ImageGallery images={images} alt={name} />

        <div className="hotel-detail-grid">
          <div className="hotel-detail-main">
            <section className="hotel-detail-section">
              <h2>About this hotel</h2>
              <p className="hotel-detail-description">{description}</p>
              <p className="hotel-detail-address">
                <Icon name="pin" size={14} /> {address}
              </p>
            </section>

            {amenities.length > 0 && (
              <section className="hotel-detail-section">
                <h2>Amenities</h2>
                <div className="amenity-badge-grid">
                  {amenities.map((a) => (
                    <span className="amenity-badge" key={a}>
                      <Icon name="check" size={14} /> {a}
                    </span>
                  ))}
                </div>
              </section>
            )}

            <section className="hotel-detail-section rooms-section">
              <div className="rooms-section-header">
                <h2>{availabilityStatus === 'idle' ? 'Our rooms' : 'Available rooms'}</h2>
                {availabilityStatus !== 'idle' && (
                  <button type="button" className="rooms-show-all" onClick={resetAvailabilitySearch}>
                    Show all rooms
                  </button>
                )}
              </div>

              {/* Default view: the hotel's own rooms, shown before any dates
                  are chosen so the page is never empty. Continuing to booking
                  is only offered once dates have been selected. */}
              {availabilityStatus === 'idle' && (
                <>
                  {hotelRoomsStatus === 'loading' && (
                    <div className="section-loading">
                      <Spinner size="lg" label="Loading rooms" />
                    </div>
                  )}

                  {hotelRoomsStatus === 'error' && (
                    <ErrorState
                      description="We couldn't load this hotel's rooms right now. Please try again."
                      onRetry={fetchHotelRooms}
                    />
                  )}

                  {hotelRoomsStatus === 'empty' && (
                    <EmptyState
                      icon={<Icon name="bed" size={26} />}
                      title="No rooms listed yet"
                      description="This hotel hasn't published any rooms yet. Please check back soon."
                    />
                  )}

                  {hotelRoomsStatus === 'success' && (
                    <>
                      <p className="rooms-section-hint">
                        Choose your check-in and check-out dates to check availability and book.
                      </p>
                      <div className="rooms-grid">
                        {hotelRooms.map((room) => (
                          <RoomCard room={room} key={room._id} />
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}

              {/* Date-filtered view: only rooms actually free for the chosen
                  range, from GET /api/rooms/availability. */}
              {availabilityStatus === 'loading' && (
                <div className="section-loading">
                  <Spinner size="lg" label="Checking availability" />
                </div>
              )}

              {availabilityStatus === 'error' && (
                <ErrorState
                  description="We couldn't check availability right now. Please try again."
                  onRetry={() => searchedRange && handleAvailabilitySearch(searchedRange)}
                />
              )}

              {availabilityStatus === 'empty' && (
                <EmptyState
                  icon={<Icon name="bed" size={26} />}
                  title="No rooms available for these dates"
                  description="Try a different date range, or reduce the number of guests."
                />
              )}

              <Notice type="info" onDismiss={() => setAdminNotice('')}>{adminNotice}</Notice>

              {availabilityStatus === 'success' && (
                <div className="rooms-grid">
                  {availableRooms.map((room) => (
                    <RoomCard room={room} key={room._id} onContinue={handleContinueBooking} />
                  ))}
                </div>
              )}
            </section>

            <ReviewsSection
              hotelId={id}
              hotelName={name}
              rating={rating || 0}
              onRatingChange={handleRatingChange}
            />
          </div>

          <aside className="hotel-detail-sidebar">
            <div className="availability-panel">
              <h3>Check availability</h3>
              <RoomAvailabilityForm
                initialCheckIn={searchParams.get('checkIn') || ''}
                initialCheckOut={searchParams.get('checkOut') || ''}
                initialGuests={Number(searchParams.get('guests')) || 2}
                onSearch={handleAvailabilitySearch}
                loading={availabilityStatus === 'loading'}
              />
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
