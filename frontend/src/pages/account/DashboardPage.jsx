import { Link } from 'react-router-dom';
import PageHeading from '../../components/account/PageHeading';
import StateBlock from '../../components/account/StateBlock';
import BookingRow from '../../components/account/BookingRow';
import EmptyState from '../../components/ui/EmptyState';
import Icon from '../../components/ui/Icon';
import Avatar from '../../components/ui/Avatar';
import { useAuth } from '../../context/AuthContext';
import useApiData from '../../hooks/useApiData';
import userService from '../../services/userService';

const ERR = 'We could not load your dashboard. Please try again.';

const STATS = [
  { key: 'totalBookings', label: 'Total bookings', icon: 'calendar', tone: 'primary' },
  { key: 'upcomingBookings', label: 'Upcoming', icon: 'compass', tone: 'accent' },
  { key: 'completedBookings', label: 'Completed stays', icon: 'check', tone: 'success' },
  { key: 'cancelledBookings', label: 'Cancelled', icon: 'x', tone: 'danger' },
  { key: 'reviewsWritten', label: 'Reviews written', icon: 'star', tone: 'warning' },
  { key: 'awaitingReview', label: 'Awaiting your review', icon: 'sparkle', tone: 'primary' },
];

export default function DashboardPage() {
  const { status, data, error, reload } = useApiData(userService.getDashboard, ERR);
  // The session copy is what the profile page updates, so a new photo shows here at once.
  const { user } = useAuth();

  return (
    <>
      <PageHeading
        title={data?.user?.name ? `Welcome back, ${data.user.name.split(' ')[0]}` : 'Dashboard'}
        description="Your trips and activity at a glance."
        leading={<Avatar src={user?.profileImage} name={user?.name} size={56} />}
      >
        <Link to="/hotels" className="ui-btn ui-btn-primary">
          <span className="ui-btn-label">Find a hotel</span>
        </Link>
      </PageHeading>

      <StateBlock status={status} error={error} onRetry={reload} label="Loading your dashboard">
        {data && (
          <>
            <div className="acct-stat-grid">
              {STATS.map(({ key, label, icon, tone }) => (
                <div key={key} className={`acct-stat tone-${tone}`}>
                  <span className="acct-stat-icon"><Icon name={icon} size={18} /></span>
                  <span className="acct-stat-value">{data.stats?.[key] ?? 0}</span>
                  <span className="acct-stat-label">{label}</span>
                </div>
              ))}
            </div>

            {data.stats?.awaitingReview > 0 && (
              <div className="info-banner" role="status">
                <span>
                  You have {data.stats.awaitingReview} completed {data.stats.awaitingReview === 1 ? 'stay' : 'stays'} waiting for a review.{' '}
                  <Link to="/account/bookings?status=completed">Review your stays</Link>
                </span>
              </div>
            )}

            <section className="card acct-section" aria-labelledby="upcoming-heading">
              <div className="acct-section-head">
                <h2 id="upcoming-heading">Next trips</h2>
                <Link to="/account/bookings">All bookings</Link>
              </div>
              {data.upcoming?.length ? (
                <ul className="booking-row-list">{data.upcoming.map((b) => <BookingRow key={b._id} booking={b} />)}</ul>
              ) : (
                <EmptyState
                  icon={<Icon name="compass" size={26} />}
                  title="No upcoming trips"
                  description="When you book a stay, your next three trips appear here."
                  action={<Link to="/hotels" className="ui-btn ui-btn-primary"><span className="ui-btn-label">Browse hotels</span></Link>}
                />
              )}
            </section>

            <section className="card acct-section" aria-labelledby="recent-heading">
              <div className="acct-section-head">
                <h2 id="recent-heading">Recent bookings</h2>
              </div>
              {data.recentBookings?.length ? (
                <ul className="booking-row-list">{data.recentBookings.map((b) => <BookingRow key={b._id} booking={b} />)}</ul>
              ) : (
                <EmptyState icon={<Icon name="bed" size={26} />} title="No bookings yet" description="Your five most recent bookings will show up here." />
              )}
            </section>
          </>
        )}
      </StateBlock>
    </>
  );
}
