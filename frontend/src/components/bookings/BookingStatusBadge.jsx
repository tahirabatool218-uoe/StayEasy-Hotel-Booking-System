import Badge from '../ui/Badge';

// Maps the backend's fixed Booking.status enum (see src/models/Booking.js)
// to the existing ui-badge tones so colors stay in the design system and
// remain accessible in both themes (no hard-coded status colors here).
const STATUS_CONFIG = {
  pending: { tone: 'warning', label: 'Pending' },
  confirmed: { tone: 'accent', label: 'Confirmed' },
  completed: { tone: 'primary', label: 'Completed' },
  cancelled: { tone: 'danger', label: 'Cancelled' },
};

export default function BookingStatusBadge({ status }) {
  const config = STATUS_CONFIG[status] || { tone: 'neutral', label: status };
  return <Badge tone={config.tone}>{config.label}</Badge>;
}
