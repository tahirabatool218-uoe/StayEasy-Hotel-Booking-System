import { useEffect, useState } from 'react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import ImageUploader from '../uploads/ImageUploader';
import { formatList, parseList } from '../../utils/lists';

const ROOM_STATUSES = [
  { value: 'available', label: 'Available', hint: 'Can be booked' },
  { value: 'maintenance', label: 'Maintenance', hint: 'Temporarily closed' },
  { value: 'inactive', label: 'Inactive', hint: 'Hidden from guests' },
];

const AMENITY_SUGGESTIONS = ['wifi', 'tv', 'air-conditioning', 'mini-bar', 'balcony', 'breakfast', 'parking', 'sea-view'];

const EMPTY = {
  hotel: '',
  roomNumber: '',
  roomType: '',
  description: '',
  pricePerNight: '',
  capacity: '2',
  status: 'available',
  amenities: '',
};

const toFormState = (room, hotels) =>
  room
    ? {
        hotel: String(room.hotel?._id || room.hotel || ''),
        roomNumber: room.roomNumber ?? '',
        roomType: room.roomType ?? '',
        description: room.description ?? '',
        pricePerNight: String(room.pricePerNight ?? ''),
        capacity: String(room.capacity ?? 2),
        status: room.status ?? 'available',
        amenities: formatList(room.amenities),
      }
    : { ...EMPTY, hotel: hotels.length === 1 ? hotels[0]._id : '' };

const hasAmenity = (list, name) => list.some((item) => item.toLowerCase() === name.toLowerCase());

// Create / edit form for a room. Pass `room` to edit, or null to create.
//
// `hotels` is the list to pick the parent hotel from. The backend rejects a
// room whose hotel does not exist, so the select is built from real hotel IDs
// rather than free text. Required fields mirror createRoom in
// src/controllers/roomController.js. The submitted payload is unchanged by the
// redesign; only the layout (sections, status picker, amenity chips) is new.
export default function RoomFormModal({ room, hotels, open, submitting, serverError, onClose, onSubmit }) {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [images, setImages] = useState([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(toFormState(room, hotels));
      setImages(Array.isArray(room?.images) ? room.images : []);
      setErrors({});
    }
  }, [open, room, hotels]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !submitting) onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, submitting, onClose]);

  if (!open) return null;

  const set = (key) => (event) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  };

  const amenityList = parseList(form.amenities);

  const toggleAmenity = (name) => {
    setForm((prev) => {
      const current = parseList(prev.amenities);
      const next = hasAmenity(current, name)
        ? current.filter((item) => item.toLowerCase() !== name.toLowerCase())
        : [...current, name];
      return { ...prev, amenities: formatList(next) };
    });
  };

  const validate = () => {
    const next = {};

    if (!form.hotel) next.hotel = 'Choose a hotel';
    ['roomNumber', 'roomType', 'description'].forEach((key) => {
      if (!String(form[key]).trim()) next[key] = 'This field is required';
    });

    const price = Number(form.pricePerNight);
    if (String(form.pricePerNight).trim() === '' || Number.isNaN(price) || price < 0) {
      next.pricePerNight = 'Enter a price of 0 or more';
    }

    const capacity = Number(form.capacity);
    if (String(form.capacity).trim() === '' || Number.isNaN(capacity) || capacity < 1) {
      next.capacity = 'Capacity must be at least 1';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (submitting || uploading) return;
    if (!validate()) return;

    onSubmit({
      hotel: form.hotel,
      roomNumber: form.roomNumber.trim(),
      roomType: form.roomType.trim(),
      description: form.description.trim(),
      pricePerNight: Number(form.pricePerNight),
      capacity: Number(form.capacity),
      status: form.status,
      amenities: parseList(form.amenities),
      images,
    });
  };

  const noHotels = hotels.length === 0;

  return (
    <div
      className="modal-overlay"
      onClick={() => {
        if (!submitting) onClose();
      }}
      role="presentation"
    >
      <div
        className="modal modal-lg room-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="room-form-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="room-modal-header">
          <div>
            <h3 id="room-form-title">{room ? 'Edit room' : 'Add room'}</h3>
            <p>{room ? 'Update this room’s details, photos and availability.' : 'Add a new room to one of your hotels.'}</p>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close" disabled={submitting}>
            &times;
          </button>
        </div>

        <form className="room-form" onSubmit={handleSubmit} noValidate>
          <div className="room-form-body">
            {serverError && <p className="admin-form-error" role="alert">{serverError}</p>}

            {noHotels ? (
              <p className="admin-form-error">
                Add a hotel first — a room has to belong to one. Close this and use “Add hotel”.
              </p>
            ) : (
              <>
                <fieldset className="room-section">
                  <legend>Basic details</legend>
                  <div className="admin-form-grid">
                    <div className="admin-form-field is-full">
                      <label htmlFor="room-hotel">Hotel</label>
                      <select id="room-hotel" className="room-select" value={form.hotel} onChange={set('hotel')} aria-invalid={Boolean(errors.hotel)}>
                        <option value="">Select a hotel…</option>
                        {hotels.map((hotel) => (
                          <option key={hotel._id} value={hotel._id}>
                            {hotel.name} — {hotel.city}
                          </option>
                        ))}
                      </select>
                      {errors.hotel && <span className="admin-form-hint is-error">{errors.hotel}</span>}
                    </div>

                    <Input label="Room number" value={form.roomNumber} onChange={set('roomNumber')} error={errors.roomNumber} wrapperClassName="admin-form-field" placeholder="201" />
                    <Input label="Room type" value={form.roomType} onChange={set('roomType')} error={errors.roomType} wrapperClassName="admin-form-field" placeholder="Deluxe" />
                  </div>
                </fieldset>

                <fieldset className="room-section">
                  <legend>Pricing &amp; capacity</legend>
                  <div className="admin-form-grid">
                    <Input
                      label="Price per night"
                      icon="$"
                      type="number"
                      min="0"
                      step="1"
                      inputMode="decimal"
                      value={form.pricePerNight}
                      onChange={set('pricePerNight')}
                      error={errors.pricePerNight}
                      wrapperClassName="admin-form-field"
                      placeholder="120"
                    />
                    <Input
                      label="Guests (capacity)"
                      type="number"
                      min="1"
                      step="1"
                      inputMode="numeric"
                      value={form.capacity}
                      onChange={set('capacity')}
                      error={errors.capacity}
                      wrapperClassName="admin-form-field"
                    />
                  </div>

                  <div className="admin-form-field">
                    <span className="room-label" id="room-status-label">Status</span>
                    <div className="room-status" role="radiogroup" aria-labelledby="room-status-label">
                      {ROOM_STATUSES.map(({ value, label, hint }) => (
                        <label key={value} className={`room-status-option tone-${value} ${form.status === value ? 'is-selected' : ''}`}>
                          <input type="radio" name="room-status" value={value} checked={form.status === value} onChange={set('status')} />
                          <span className="room-status-label">{label}</span>
                          <span className="room-status-hint">{hint}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </fieldset>

                <fieldset className="room-section">
                  <legend>Amenities</legend>
                  <Input
                    label="Amenities"
                    wrapperClassName="admin-form-field"
                    value={form.amenities}
                    onChange={set('amenities')}
                    placeholder="wifi, tv, air-conditioning"
                    hint="Type your own, separated by commas, or tap a suggestion."
                  />
                  <div className="room-chips" aria-label="Quick-add amenities">
                    {AMENITY_SUGGESTIONS.map((name) => {
                      const active = hasAmenity(amenityList, name);
                      return (
                        <button
                          key={name}
                          type="button"
                          className={`room-chip ${active ? 'is-active' : ''}`}
                          aria-pressed={active}
                          onClick={() => toggleAmenity(name)}
                          disabled={submitting}
                        >
                          {active ? '✓ ' : '+ '}
                          {name}
                        </button>
                      );
                    })}
                  </div>
                </fieldset>

                <fieldset className="room-section">
                  <legend>Photos</legend>
                  <ImageUploader images={images} onChange={setImages} onBusyChange={setUploading} disabled={submitting} label="Room images" />
                </fieldset>

                <fieldset className="room-section">
                  <legend>Description</legend>
                  <div className="admin-form-field">
                    <label htmlFor="room-description" className="room-sr-only">Description</label>
                    <textarea
                      id="room-description"
                      rows={4}
                      value={form.description}
                      onChange={set('description')}
                      placeholder="Spacious deluxe room with a balcony."
                      aria-invalid={Boolean(errors.description)}
                    />
                    {errors.description && <span className="admin-form-hint is-error">{errors.description}</span>}
                  </div>
                </fieldset>
              </>
            )}
          </div>

          <div className="room-form-footer">
            {uploading && <span className="room-form-note" role="status">Uploading photos…</span>}
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting} disabled={noHotels || uploading}>
              {room ? 'Save changes' : 'Create room'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
