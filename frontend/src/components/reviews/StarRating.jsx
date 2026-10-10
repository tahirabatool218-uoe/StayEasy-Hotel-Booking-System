import { useState } from 'react';

const STAR_PATH = 'm12 3 2.6 5.6 6.1.6-4.6 4.1 1.3 6-5.4-3.1L6.6 19.3l1.3-6-4.6-4.1 6.1-.6L12 3Z';

function Star({ filled, size }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" className={`star ${filled ? 'is-filled' : ''}`}>
      <path d={STAR_PATH} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

// Read-only when `onChange` is omitted; otherwise an accessible radio group.
export default function StarRating({ value = 0, onChange, size = 16, label = 'Rating' }) {
  const [hover, setHover] = useState(0);
  const stars = [1, 2, 3, 4, 5];

  if (!onChange) {
    return (
      <span className="star-rating" role="img" aria-label={`${value} out of 5 stars`}>
        {stars.map((n) => (
          <Star key={n} filled={n <= Math.round(value)} size={size} />
        ))}
      </span>
    );
  }

  const shown = hover || value;
  return (
    <div className="star-rating star-rating-input" role="radiogroup" aria-label={label} onMouseLeave={() => setHover(0)}>
      {stars.map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n === 1 ? '' : 's'}`}
          className="star-btn"
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          onFocus={() => setHover(n)}
          onBlur={() => setHover(0)}
        >
          <Star filled={n <= shown} size={size} />
        </button>
      ))}
    </div>
  );
}
