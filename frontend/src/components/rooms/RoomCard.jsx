import Icon from '../ui/Icon';
import Badge from '../ui/Badge';

const formatPrice = (value) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);

const STATUS_TONE = {
  available: 'accent',
  maintenance: 'warning',
  inactive: 'neutral',
};

// room: a backend Room document (see src/models/Room.js), as returned by
// GET /api/rooms/availability. `onContinue` is called with the room when
// the person wants to move toward booking it — actual booking creation
// (POST /api/bookings) is out of scope for this phase.
export default function RoomCard({ room, onContinue, showStatus = false }) {
  const { roomNumber, roomType, description, pricePerNight, capacity, amenities = [], images = [], status } = room;
  const cover = images[0];

  return (
    <div className="room-card">
      <div className="room-card-media">
        {cover ? (
          <img src={cover} alt={roomType} loading="lazy" />
        ) : (
          <div className="room-card-media-fallback" aria-hidden="true">
            <Icon name="bed" size={24} />
          </div>
        )}
      </div>

      <div className="room-card-body">
        <div className="room-card-heading">
          <div>
            <h4>{roomType}</h4>
            <span className="room-card-number">Room {roomNumber}</span>
          </div>
          {showStatus && status && <Badge tone={STATUS_TONE[status] || 'neutral'}>{status}</Badge>}
        </div>

        {description && <p className="room-card-description">{description}</p>}

        <div className="room-card-meta">
          <span>
            <Icon name="guests" size={14} /> Sleeps {capacity}
          </span>
        </div>

        {amenities.length > 0 && (
          <div className="room-card-amenities">
            {amenities.slice(0, 4).map((a) => (
              <span className="room-card-amenity" key={a}>
                {a}
              </span>
            ))}
            {amenities.length > 4 && <span className="room-card-amenity">+{amenities.length - 4} more</span>}
          </div>
        )}

        <div className="room-card-footer">
          <span className="room-card-price">
            {formatPrice(pricePerNight)} <span>/ night</span>
          </span>
          {onContinue && (
            <button type="button" className="ui-btn ui-btn-primary ui-btn-sm" onClick={() => onContinue(room)}>
              <span className="ui-btn-label">Continue to booking</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
