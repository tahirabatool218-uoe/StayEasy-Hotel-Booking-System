import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../ui/Icon';
import Button from '../ui/Button';

const today = new Date().toISOString().split('T')[0];

export default function SearchPanel() {
  const navigate = useNavigate();
  const [destination, setDestination] = useState('');
  const [checkIn, setCheckIn] = useState('');
  const [checkOut, setCheckOut] = useState('');
  const [guests, setGuests] = useState(2);
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (checkIn && checkOut && checkOut <= checkIn) {
      setError('Check-out must be after check-in.');
      return;
    }

    const params = new URLSearchParams();
    if (destination.trim()) params.set('search', destination.trim());
    if (checkIn) params.set('checkIn', checkIn);
    if (checkOut) params.set('checkOut', checkOut);
    if (guests) params.set('guests', String(guests));

    navigate(`/hotels${params.toString() ? `?${params.toString()}` : ''}`);
  };

  const adjustGuests = (delta) => {
    setGuests((prev) => Math.min(10, Math.max(1, prev + delta)));
  };

  return (
    <form className="search-panel" onSubmit={handleSubmit} aria-label="Search hotels">
      <div className="search-field search-field-destination">
        <span className="search-field-label">
          <Icon name="pin" size={15} /> Destination
        </span>
        <input
          type="text"
          placeholder="City, hotel or region"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
        />
      </div>

      <div className="search-field">
        <span className="search-field-label">
          <Icon name="calendar" size={15} /> Check-in
        </span>
        <input type="date" min={today} value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
      </div>

      <div className="search-field">
        <span className="search-field-label">
          <Icon name="calendar" size={15} /> Check-out
        </span>
        <input
          type="date"
          min={checkIn || today}
          value={checkOut}
          onChange={(e) => setCheckOut(e.target.value)}
        />
      </div>

      <div className="search-field search-field-guests">
        <span className="search-field-label">
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

      <Button type="submit" variant="primary" className="search-submit">
        <Icon name="search" size={17} /> Search hotels
      </Button>

      {error && (
        <p className="search-panel-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
