import { useEffect, useId, useState } from 'react';
import Icon from '../ui/Icon';
import useDebouncedValue from '../../hooks/useDebouncedValue';

// A small curated list — the backend `amenity` filter is a plain
// case-insensitive exact match (see src/controllers/hotelController.js),
// so these are just convenient starting points, not an enum.
const AMENITY_SUGGESTIONS = ['WiFi', 'Parking', 'Pool', 'Breakfast', 'Gym', 'Spa', 'Air conditioning', 'Pet friendly'];
const RATING_OPTIONS = [4, 3, 2, 1];

// `values`  : { city, country, minPrice, maxPrice, minRating, amenity }
// `onChange`: (patch) => void — merges a partial update into the parent's filter state
// `onClear` : () => void
export default function FilterPanel({ values, onChange, onClear, activeCount = 0 }) {
  const [city, setCity] = useState(values.city || '');
  const [country, setCountry] = useState(values.country || '');
  const [minPrice, setMinPrice] = useState(values.minPrice || '');
  const [maxPrice, setMaxPrice] = useState(values.maxPrice || '');
  const [amenity, setAmenity] = useState(values.amenity || '');

  // HotelsPage renders this panel twice at once (the sidebar and the mobile
  // drawer), so fixed ids such as "filter-city" would appear twice in the DOM
  // and both <label htmlFor> would resolve to the first one. React's useId
  // keeps every instance's ids unique.
  const idPrefix = useId();
  const ids = {
    city: `${idPrefix}-city`,
    country: `${idPrefix}-country`,
    amenity: `${idPrefix}-amenity`,
    suggestions: `${idPrefix}-amenity-suggestions`,
  };

  // Stay in sync when filters change from outside this panel (URL back/forward,
  // "Clear all", a destination search on the homepage, etc).
  useEffect(() => {
    setCity(values.city || '');
    setCountry(values.country || '');
    setMinPrice(values.minPrice || '');
    setMaxPrice(values.maxPrice || '');
    setAmenity(values.amenity || '');
  }, [values.city, values.country, values.minPrice, values.maxPrice, values.amenity]);

  const debouncedCity = useDebouncedValue(city);
  const debouncedCountry = useDebouncedValue(country);
  const debouncedMinPrice = useDebouncedValue(minPrice);
  const debouncedMaxPrice = useDebouncedValue(maxPrice);
  const debouncedAmenity = useDebouncedValue(amenity);

  // Only push a change once the debounced values actually differ from what
  // the parent already has — avoids an extra request on first mount.
  useEffect(() => {
    if (
      debouncedCity === (values.city || '') &&
      debouncedCountry === (values.country || '') &&
      debouncedMinPrice === (values.minPrice || '') &&
      debouncedMaxPrice === (values.maxPrice || '') &&
      debouncedAmenity === (values.amenity || '')
    ) {
      return;
    }
    onChange({
      city: debouncedCity,
      country: debouncedCountry,
      minPrice: debouncedMinPrice,
      maxPrice: debouncedMaxPrice,
      amenity: debouncedAmenity,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedCity, debouncedCountry, debouncedMinPrice, debouncedMaxPrice, debouncedAmenity]);

  const toggleRating = (rating) => {
    onChange({ minRating: String(values.minRating) === String(rating) ? '' : String(rating) });
  };

  const toggleAmenityChip = (a) => {
    setAmenity((prev) => (prev.toLowerCase() === a.toLowerCase() ? '' : a));
  };

  return (
    <div className="filter-panel">
      <div className="filter-panel-header">
        <h3>Filters</h3>
        {activeCount > 0 && (
          <button type="button" className="filter-clear" onClick={onClear}>
            Clear all
          </button>
        )}
      </div>

      <div className="filter-group">
        <label className="filter-label" htmlFor={ids.city}>
          City
        </label>
        <input
          id={ids.city}
          type="text"
          placeholder="e.g. Lisbon"
          value={city}
          onChange={(e) => setCity(e.target.value)}
        />
      </div>

      <div className="filter-group">
        <label className="filter-label" htmlFor={ids.country}>
          Country
        </label>
        <input
          id={ids.country}
          type="text"
          placeholder="e.g. Portugal"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
        />
      </div>

      <div className="filter-group">
        <span className="filter-label">Price per night</span>
        <div className="filter-price-row">
          <input
            type="number"
            min="0"
            inputMode="numeric"
            placeholder="Min"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
          />
          <span className="filter-price-sep">–</span>
          <input
            type="number"
            min="0"
            inputMode="numeric"
            placeholder="Max"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
          />
        </div>
      </div>

      <div className="filter-group">
        <span className="filter-label">Minimum rating</span>
        <div className="filter-rating-row">
          {RATING_OPTIONS.map((r) => (
            <button
              type="button"
              key={r}
              className={`filter-rating-chip ${String(values.minRating) === String(r) ? 'is-active' : ''}`}
              onClick={() => toggleRating(r)}
            >
              <Icon name="star" size={13} /> {r}+
            </button>
          ))}
        </div>
      </div>

      <div className="filter-group">
        <label className="filter-label" htmlFor={ids.amenity}>
          Amenity
        </label>
        <input
          id={ids.amenity}
          type="text"
          list={ids.suggestions}
          placeholder="e.g. Pool"
          value={amenity}
          onChange={(e) => setAmenity(e.target.value)}
        />
        <datalist id={ids.suggestions}>
          {AMENITY_SUGGESTIONS.map((a) => (
            <option value={a} key={a} />
          ))}
        </datalist>
        <div className="filter-chip-row">
          {AMENITY_SUGGESTIONS.slice(0, 5).map((a) => (
            <button
              type="button"
              key={a}
              className={`filter-chip ${amenity.toLowerCase() === a.toLowerCase() ? 'is-active' : ''}`}
              onClick={() => toggleAmenityChip(a)}
            >
              {a}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
