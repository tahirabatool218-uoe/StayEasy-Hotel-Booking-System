import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import adminService from '../../services/adminService';
import UserCell from '../../components/admin/UserCell';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import BookingStatusBadge from '../../components/bookings/BookingStatusBadge';
import Button from '../../components/ui/Button';
import ErrorState from '../../components/ui/ErrorState';
import Icon from '../../components/ui/Icon';
import Avatar from '../../components/ui/Avatar';
import { useAuth } from '../../context/AuthContext';
import Spinner from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { formatPrice, formatShortStayDate } from '../../utils/booking';
import { getApiError } from '../../utils/errors';

const STAT_TILES = [
  { key: 'totalHotels', label: 'Hotels', icon: 'building', tone: 'primary' },
  { key: 'totalRooms', label: 'Rooms', icon: 'bed', tone: 'accent' },
  { key: 'totalBookings', label: 'Bookings', icon: 'calendar', tone: 'warning' },
  { key: 'totalUsers', label: 'Users', icon: 'guests', tone: 'primary' },
  { key: 'totalReviews', label: 'Reviews', icon: 'star', tone: 'accent' },
];

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // One request for the counts plus the two 5-item feeds, in parallel.
  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [statsData, bookingData, reviewData] = await Promise.all([
        adminService.getDashboardStats(),
        adminService.getRecentBookings(),
        adminService.getRecentReviews(),
      ]);
      setStats(statsData);
      setBookings(bookingData);
      setReviews(reviewData);
    } catch (err) {
      setError(getApiError(err, 'Could not load the dashboard. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return (
      <div className="admin-page">
        <div className="admin-page-state">
          <Spinner size="lg" label="Loading dashboard" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-page">
        <AdminPageHeader title="Admin Dashboard" />
        <ErrorState description={error} onRetry={load} />
      </div>
    );
  }

  const bookingBreakdown = [
    { label: 'Pending', value: stats?.pendingBookings, tone: 'warning' },
    { label: 'Confirmed', value: stats?.confirmedBookings, tone: 'accent' },
    { label: 'Completed', value: stats?.completedBookings, tone: 'primary' },
    { label: 'Cancelled', value: stats?.cancelledBookings, tone: 'danger' },
  ];

  return (
    <div className="admin-page">
      <AdminPageHeader title="Admin Dashboard" description="Everything happening across StayEasy right now.">
        <Link to="/admin/profile" className="admin-self-chip" aria-label="Your admin profile">
          <Avatar src={user?.profileImage} name={user?.name} size={32} decorative />
          <span>{user?.name?.split(' ')[0] || 'Admin'}</span>
        </Link>
        <Button variant="outline" onClick={load}>
          Refresh
        </Button>
      </AdminPageHeader>

      <div className="admin-stat-grid admin-stat-grid--overview">
        {STAT_TILES.map((tile) => (
          <div key={tile.key} className={`admin-stat tone-${tile.tone}`}>
            <span className="admin-stat-label">{tile.label}</span>
            <span className="admin-stat-value">{stats?.[tile.key] ?? 0}</span>
            <span className="admin-stat-icon">
              <Icon name={tile.icon} size={20} />
            </span>
          </div>
        ))}
        <div className="admin-stat tone-warning">
          <span className="admin-stat-label">Average rating</span>
          <span className="admin-stat-value">{stats?.averageHotelRating ?? '—'}</span>
          {stats?.averageHotelRating == null && <span className="admin-stat-hint">No reviews yet</span>}
          <span className="admin-stat-icon">
            <Icon name="star" size={20} />
          </span>
        </div>
      </div>

      <div className="admin-stat-grid">
        <div className="admin-stat tone-success admin-stat--wide">
          <span className="admin-stat-label">Booked revenue</span>
          <span className="admin-stat-value">{formatPrice(stats?.bookedRevenue ?? 0)}</span>
          <span className="admin-stat-hint">
            Total value of confirmed and completed bookings. This is booked value, not money received: StayEasy does not process payments.
          </span>
          <span className="admin-stat-icon">
            <Icon name="check" size={20} />
          </span>
        </div>
      </div>

      <div className="admin-panel">
        <div className="admin-panel-header">
          <div>
            <h2>Bookings by status</h2>
            <p>{stats?.totalBookings ?? 0} bookings in total</p>
          </div>
          <Link className="ui-btn ui-btn-outline" to="/admin/bookings">
            Manage bookings
          </Link>
        </div>
        <div className="admin-stat-grid">
          {bookingBreakdown.map((item) => (
            <div key={item.label} className={`admin-stat tone-${item.tone}`}>
              <span className="admin-stat-label">
                <span className="admin-stat-dot" />
                {item.label}
              </span>
              <span className="admin-stat-value">{item.value ?? 0}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="admin-panel">
        <div className="admin-panel-header">
          <div>
            <h2>Rooms by status</h2>
            <p>{stats?.totalRooms ?? 0} rooms in total</p>
          </div>
          <Link className="ui-btn ui-btn-outline" to="/admin/rooms">
            Manage rooms
          </Link>
        </div>
        <div className="admin-stat-grid">
          <div className="admin-stat tone-success">
            <span className="admin-stat-label">
              <span className="admin-stat-dot" />
              Available
            </span>
            <span className="admin-stat-value">{stats?.availableRooms ?? 0}</span>
          </div>
          <div className="admin-stat tone-warning">
            <span className="admin-stat-label">
              <span className="admin-stat-dot" />
              Maintenance
            </span>
            <span className="admin-stat-value">{stats?.maintenanceRooms ?? 0}</span>
          </div>
          <div className="admin-stat tone-danger">
            <span className="admin-stat-label">
              <span className="admin-stat-dot" />
              Inactive
            </span>
            <span className="admin-stat-value">{stats?.inactiveRooms ?? 0}</span>
          </div>
        </div>
      </div>

      <div className="admin-panel">
        <div className="admin-panel-header">
          <div>
            <h2>Latest bookings</h2>
            <p>The 5 most recent reservations</p>
          </div>
        </div>
        {bookings.length === 0 ? (
          <EmptyState title="No bookings yet" description="Reservations will appear here as soon as guests book." />
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">Guest</th>
                  <th scope="col">Stay</th>
                  <th scope="col" className="is-numeric">Total</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((booking) => (
                  <tr key={booking._id}>
                    <td>
                      <UserCell user={booking.user} />
                    </td>
                    <td>
                      {booking.hotel?.name || 'Deleted hotel'}
                      <span className="admin-cell-sub">
                        {formatShortStayDate(booking.checkInDate)} → {formatShortStayDate(booking.checkOutDate)}
                      </span>
                    </td>
                    <td className="is-numeric">{formatPrice(booking.totalPrice)}</td>
                    <td>
                      <BookingStatusBadge status={booking.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="admin-panel">
        <div className="admin-panel-header">
          <div>
            <h2>Latest reviews</h2>
            <p>The 5 most recent guest reviews</p>
          </div>
          <Link className="ui-btn ui-btn-outline" to="/admin/reviews">
            Moderate reviews
          </Link>
        </div>
        {reviews.length === 0 ? (
          <EmptyState title="No reviews yet" description="Guest feedback will show up here once stays are completed." />
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">Guest</th>
                  <th scope="col">Hotel</th>
                  <th scope="col" className="is-numeric">Rating</th>
                  <th scope="col">Comment</th>
                </tr>
              </thead>
              <tbody>
                {reviews.map((review) => (
                  <tr key={review._id}>
                    <td>
                      <UserCell user={review.user} />
                    </td>
                    <td>
                      {review.hotel?.name || 'Deleted hotel'}
                      {review.hotel?.city && <span className="admin-cell-sub">{review.hotel.city}</span>}
                    </td>
                    <td className="is-numeric">
                      <span className="admin-rating">
                        <Icon name="star" size={14} />
                        {review.rating}
                      </span>
                    </td>
                    <td>
                      <span className="admin-comment-cell" title={review.comment}>
                        {review.comment}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
