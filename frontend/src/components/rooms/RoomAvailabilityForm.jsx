import { useEffect, useState } from 'react';
import Icon from '../ui/Icon';
import Button from '../ui/Button';

const today = new Date().toISOString().split('T')[0];

// This component only validates input and reports the chosen values —
// the actual GET /api/rooms/availability call is owned by the parent page
// (HotelDetailsPage) so API logic stays in one place.
export default function RoomAvailabilityForm({
  initialCheckIn = '',
  initialCheckOut = '',
  initialGuests = 2,
  onSearch,
  loading = false,
}) {
  const [checkIn, setCheckIn] = useState(initialCheckIn);
  const [checkOut, setCheckOut] = useState(initialCheckOut);
  const [guests, setGuests] = useState(initialGuests || 2);
  const [error, setError] = useState('');

  // Re-sync when the initial values change from outside this form. The parent
  // (HotelDetailsPage) owns the selection in the URL and rewrites it after a
  // search, after "Show all rooms", and when the visitor arrives on a link
  // that already carries dates. Without this the inputs would keep showing
  // whatever was typed last while the results grid showed the new selection.
  useEffect(() => {
    setCheckIn(initialCheckIn);
    setCheckOut(initialCheckOut);
    setGuests(initialGuests || 2);
  }, [initialCheckIn, initialCheckOut, initialGuests]);

  const adjustGuests = (delta) => setGuests((prev) => Math.min(20, Math.max(1, Number(prev || 1) + delta)));

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!checkIn || !checkOut) {
      setError('Please choose both a check-in and check-out date.');
      return;
    }
    if (checkOut <= checkIn) {
      setError('Check-out must be later than check-in.');
      return;
    }
    if (!guests || Number(guests) < 1) {
      setError('There must be at least 1 guest.');
      return;
    }

    setError('');
    onSearch({ checkInDate: checkIn, checkOutDate: checkOut, guests: Number(guests) });
  };

  return (
    <form className="availability-form" onSubmit={handleSubmit} aria-label="Check room availability">
      <div className="availability-field">
        <span className="availability-label">
          <Icon name="calendar" size={15} /> Check-in
        </span>
        <input type="date" min={today} value={checkIn} onChange={(e) => setCheckIn(e.target.value)} required />
      </div>

      <div className="availability-field">
        <span className="availability-label">
          <Icon name="calendar" size={15} /> Check-out
        </span>
        <input
          type="date"
          min={checkIn || today}
          value={checkOut}
          onChange={(e) => setCheckOut(e.target.value)}
          required
        />
      </div>

      <div className="availability-field availability-field-guests">
        <span className="availability-label">
          <Icon name="guests" size={15} /> Guests
        </span>
        <div className="guest-stepper">
          <button type="button" onClick={() => adjustGuests(-1)} aria-label="Decrease guests">
            −
          </button>
          <span>{guests}</span>
          <button type="button" onClick={() => adjustGuests(1)} aria-label="Increase guests">
            +
          </button>
        </div>
      </div>

      <Button type="submit" variant="primary" loading={loading} className="availability-submit">
        <Icon name="search" size={16} /> Check availability
      </Button>

      {error && (
        <p className="availability-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
