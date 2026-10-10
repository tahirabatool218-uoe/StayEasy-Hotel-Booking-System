import { Link } from 'react-router-dom';
import Icon from '../ui/Icon';
import Badge from '../ui/Badge';

const formatPrice = (value) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);

// hotel: the raw backend Hotel document (see src/models/Hotel.js)
// queryParams: optional object (e.g. { checkIn, checkOut, guests }) whose
// present values are carried onto the details link, so a date/guest search
// made on the hotel list survives navigation into the details page.
export default function HotelCard({ hotel, queryParams }) {
  const { _id, name, city, country, pricePerNight, rating, images, amenities = [], description } = hotel;
  const cover = images && images.length > 0 ? images[0] : null;

  const query = new URLSearchParams();
  if (queryParams) {
    Object.entries(queryParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') query.set(key, value);
    });
  }
  const href = `/hotels/${_id}${query.toString() ? `?${query.toString()}` : ''}`;

  return (
    <Link to={href} className="hotel-card">
      <div className="hotel-card-media">
        {cover ? (
          <img src={cover} alt={name} loading="lazy" />
        ) : (
          <div className="hotel-card-media-fallback" aria-hidden="true">
            <Icon name="compass" size={26} />
          </div>
        )}
        {rating > 0 && (
          <span className="hotel-card-rating">
            <Icon name="star" size={13} />
            {rating.toFixed(1)}
          </span>
        )}
      </div>

      <div className="hotel-card-body">
        <div className="hotel-card-heading">
          <h3>{name}</h3>
          {rating >= 4.5 && <Badge tone="accent">Top rated</Badge>}
        </div>
        <p className="hotel-card-location">
          <Icon name="pin" size={14} />
          {city}, {country}
        </p>

        {description && <p className="hotel-card-description">{description}</p>}

        {amenities.length > 0 && (
          <div className="hotel-card-amenities">
            {amenities.slice(0, 3).map((a) => (
              <span className="hotel-card-amenity" key={a}>
                {a}
              </span>
            ))}
            {amenities.length > 3 && <span className="hotel-card-amenity">+{amenities.length - 3}</span>}
          </div>
        )}

        <div className="hotel-card-footer">
          <span className="hotel-card-price">
            {formatPrice(pricePerNight)} <span>/ night</span>
          </span>
          <span className="hotel-card-cta">
            View stay <Icon name="arrowRight" size={15} />
          </span>
        </div>
      </div>
    </Link>
  );
}
