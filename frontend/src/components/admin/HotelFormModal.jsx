import { useEffect, useState } from 'react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import ImageUploader from '../uploads/ImageUploader';
import { formatList, parseList } from '../../utils/lists';

// Create / edit form for a hotel. Pass `hotel` to edit, or null to create.
//
// The required fields and their rules mirror createHotel in
// src/controllers/hotelController.js, so the form never offers a submit the
// server would reject. `totalRooms` and `rating` are deliberately absent: the
// API ignores both. The rating is calculated from guest reviews, so it is shown
// here read-only, and the admin list shows the real room count.
const EMPTY = {
  name: '',
  description: '',
  location: '',
  city: '',
  country: '',
  address: '',
  pricePerNight: '',
  amenities: '',
  isActive: true,
};

const REQUIRED = ['name', 'description', 'location', 'city', 'country', 'address'];

const toFormState = (hotel) =>
  hotel
    ? {
        name: hotel.name ?? '',
        description: hotel.description ?? '',
        location: hotel.location ?? '',
        city: hotel.city ?? '',
        country: hotel.country ?? '',
        address: hotel.address ?? '',
        pricePerNight: String(hotel.pricePerNight ?? ''),
        amenities: formatList(hotel.amenities),
        isActive: hotel.isActive !== false,
      }
    : { ...EMPTY };

export default function HotelFormModal({ hotel, open, submitting, serverError, onClose, onSubmit }) {
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  // Saved image URLs (existing ones are kept unless the admin removes them).
  const [images, setImages] = useState([]);
  const [uploading, setUploading] = useState(false);

  // Re-seed the form each time the modal opens, so a cancelled edit never leaks
  // into the next one.
  useEffect(() => {
    if (open) {
      setForm(toFormState(hotel));
      setImages(Array.isArray(hotel?.images) ? hotel.images : []);
      setErrors({});
    }
  }, [open, hotel]);

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
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));
  };

  const validate = () => {
    const next = {};

    REQUIRED.forEach((key) => {
      if (!String(form[key]).trim()) next[key] = 'This field is required';
    });

    const price = Number(form.pricePerNight);
    if (String(form.pricePerNight).trim() === '' || Number.isNaN(price) || price < 0) {
      next.pricePerNight = 'Enter a price of 0 or more';
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (submitting || uploading) return;
    if (!validate()) return;

    onSubmit({
      name: form.name.trim(),
      description: form.description.trim(),
      location: form.location.trim(),
      city: form.city.trim(),
      country: form.country.trim(),
      address: form.address.trim(),
      pricePerNight: Number(form.pricePerNight),
      amenities: parseList(form.amenities),
      images,
      isActive: form.isActive,
    });
  };

  return (
    <div
      className="modal-overlay"
      onClick={() => {
        if (!submitting) onClose();
      }}
      role="presentation"
    >
      <div
        className="modal modal-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="hotel-form-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3 id="hotel-form-title">{hotel ? 'Edit hotel' : 'Add hotel'}</h3>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close" disabled={submitting}>
            &times;
          </button>
        </div>

        <form className="admin-form" onSubmit={handleSubmit} noValidate>
          {serverError && <p className="admin-form-error">{serverError}</p>}

          <div className="admin-form-grid">
            <Input label="Name" value={form.name} onChange={set('name')} error={errors.name} wrapperClassName="admin-form-field is-full" placeholder="Grand Palace" />

            <Input label="City" value={form.city} onChange={set('city')} error={errors.city} wrapperClassName="admin-form-field" />
            <Input label="Country" value={form.country} onChange={set('country')} error={errors.country} wrapperClassName="admin-form-field" />
            <Input label="Location" value={form.location} onChange={set('location')} error={errors.location} wrapperClassName="admin-form-field is-full" placeholder="Clifton, Karachi" />
            <Input label="Address" value={form.address} onChange={set('address')} error={errors.address} wrapperClassName="admin-form-field is-full" />

            <Input label="Price per night ($)" type="number" min="0" step="1" value={form.pricePerNight} onChange={set('pricePerNight')} error={errors.pricePerNight} wrapperClassName="admin-form-field" />
            <Input
              label="Rating"
              value={hotel ? (hotel.rating > 0 ? hotel.rating : 'No reviews yet') : 'Calculated from guest reviews'}
              readOnly
              disabled
              hint="Calculated from guest reviews — it can't be edited here."
              wrapperClassName="admin-form-field"
            />

            <Input
              label="Amenities"
              wrapperClassName="admin-form-field is-full"
              value={form.amenities}
              onChange={set('amenities')}
              placeholder="Free WiFi, Swimming Pool, Restaurant"
              hint="Separate each amenity with a comma."
            />
            <div className="admin-form-field is-full">
              <ImageUploader images={images} onChange={setImages} onBusyChange={setUploading} disabled={submitting} label="Hotel images" />
            </div>

            <div className="admin-form-field is-full">
              <label htmlFor="hotel-description">Description</label>
              <textarea
                id="hotel-description"
                value={form.description}
                onChange={set('description')}
                placeholder="A modern business hotel in the heart of the city."
              />
              {errors.description && <span className="admin-form-hint is-error">{errors.description}</span>}
            </div>

            <label className="admin-checkbox is-full">
              <input type="checkbox" checked={form.isActive} onChange={set('isActive')} />
              Visible on the public site
            </label>
          </div>

          <div className="modal-actions">
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" loading={submitting} disabled={uploading}>
              {hotel ? 'Save changes' : 'Create hotel'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
