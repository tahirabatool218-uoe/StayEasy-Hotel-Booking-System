import { useCallback, useEffect, useState } from 'react';
import bookingService from '../../services/bookingService';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import BookingStatusBadge from '../../components/bookings/BookingStatusBadge';
import UserCell from '../../components/admin/UserCell';
import ConfirmDialog from '../../components/admin/ConfirmDialog';
import DataTable from '../../components/admin/DataTable';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import Spinner from '../../components/ui/Spinner';
import { calculateNights, formatPrice, formatShortStayDate } from '../../utils/booking';
import { getApiError } from '../../utils/errors';

const BOOKING_STATUSES = ['pending', 'confirmed', 'completed', 'cancelled'];

const STATUS_OPTIONS = [{ value: '', label: 'All statuses' }, ...BOOKING_STATUSES.map((s) => ({ value: s, label: s }))];

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [rowError, setRowError] = useState('');

  // Which row's status dropdown is mid-request, so it can be disabled on its own.
  const [updatingId, setUpdatingId] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setBookings(await bookingService.getAllBookings());
    } catch (err) {
      setError(getApiError(err, 'Could not load bookings. Please try again.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleStatusChange = async (booking, nextStatus) => {
    setUpdatingId(booking._id);
    setRowError('');
    try {
      const updated = await bookingService.updateBooking(booking._id, { status: nextStatus });
      setBookings((prev) => prev.map((b) => (b._id === booking._id ? { ...b, ...updated } : b)));
      setNotice(`Booking for ${booking.user?.name || 'guest'} is now ${nextStatus}.`);
    } catch (err) {
      // The select is a controlled component, so leaving `bookings` untouched
      // snaps the dropdown back to the real stored status.
      setRowError(getApiError(err, 'Could not update this booking.'));
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setConfirmingDelete(true);
    setDeleteError('');
    try {
      await bookingService.deleteBooking(deleting._id);
      setNotice('Booking deleted.');
      setDeleting(null);
      await load();
    } catch (err) {
      setDeleteError(getApiError(err, 'Could not delete this booking. Please try again.'));
      setDeleting(null);
    } finally {
      setConfirmingDelete(false);
    }
  };

  // GET /api/bookings returns every booking unpaginated, so the search box and
  // the status filter are applied here rather than on the server.
  const term = search.trim().toLowerCase();
  const visible = bookings.filter((booking) => {
    if (statusFilter && booking.status !== statusFilter) return false;
    if (!term) return true;
    return [booking.user?.name, booking.user?.email, booking.hotel?.name, booking.room?.roomNumber]
      .filter(Boolean)
      .some((field) => String(field).toLowerCase().includes(term));
  });

  const columns = [
    {
      key: 'guest',
      header: 'Guest',
      render: (booking) => <UserCell user={booking.user} />,
    },
    {
      key: 'stay',
      header: 'Stay',
      render: (booking) => (
        <>
          {booking.hotel?.name || 'Deleted hotel'}
          <span className="admin-cell-sub">
            Room {booking.room?.roomNumber ?? '—'} · {booking.room?.roomType || 'unknown type'}
          </span>
        </>
      ),
    },
    {
      key: 'dates',
      header: 'Dates',
      render: (booking) => {
        const nights = calculateNights(booking.checkInDate, booking.checkOutDate);
        return (
          <>
            {formatShortStayDate(booking.checkInDate)} → {formatShortStayDate(booking.checkOutDate)}
            <span className="admin-cell-sub">
              {nights} night{nights === 1 ? '' : 's'} · {booking.guests} guest{booking.guests === 1 ? '' : 's'}
            </span>
          </>
        );
      },
    },
    {
      key: 'totalPrice',
      header: 'Total',
      numeric: true,
      render: (booking) => formatPrice(booking.totalPrice),
    },
    {
      key: 'status',
      header: 'Status',
      render: (booking) => (
        <div className="admin-cell-actions">
          <select
            className="admin-inline-select"
            value={booking.status}
            onChange={(e) => handleStatusChange(booking, e.target.value)}
            // The backend refuses to move a completed booking to another status
            // (400), so the other options are disabled instead of failing later.
            disabled={updatingId === booking._id || booking.status === 'completed'}
            title={booking.status === 'completed' ? 'A completed booking cannot change status' : undefined}
            aria-label={`Status for booking of ${booking.user?.name || 'guest'}`}
          >
            {BOOKING_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          <BookingStatusBadge status={booking.status} />
        </div>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (booking) => (
        <div className="admin-cell-actions">
          <Button
            size="sm"
            variant="danger"
            onClick={() => {
              setDeleting(booking);
              setDeleteError('');
            }}
          >
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="admin-page">
      <AdminPageHeader title="Bookings" description="Every reservation, with the status controls guests see." />

      {notice && <p className="admin-notice admin-notice-success">{notice}</p>}
      {rowError && <p className="admin-notice admin-notice-error">{rowError}</p>}
      {deleteError && <p className="admin-notice admin-notice-error">{deleteError}</p>}

      <div className="admin-toolbar">
        <div className="admin-toolbar-search">
          <span className="admin-field-label" id="booking-search-label">
            Search
          </span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Guest name, email, hotel or room number"
            aria-labelledby="booking-search-label"
          />
        </div>

        <div className="admin-field">
          <label className="admin-field-label" htmlFor="booking-filter-status">
            Status
          </label>
          <select id="booking-filter-status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <span className="admin-toolbar-count">
          {visible.length} of {bookings.length} booking{bookings.length === 1 ? '' : 's'}
        </span>
      </div>

      {loading ? (
        <div className="admin-page-state">
          <Spinner size="lg" label="Loading bookings" />
        </div>
      ) : error ? (
        <ErrorState description={error} onRetry={load} />
      ) : (
        <DataTable
          columns={columns}
          rows={visible}
          empty={
            <EmptyState
              title="No bookings found"
              description={
                search || statusFilter ? 'No booking matches these filters. Try clearing them.' : 'No one has booked yet.'
              }
            />
          }
        />
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete this booking?"
        description={
          deleting
            ? `This removes the reservation for ${deleting.user?.name || 'this guest'} permanently. Any review they left behind stays in place.`
            : ''
        }
        confirmLabel="Yes, delete"
        submitting={confirmingDelete}
        onConfirm={handleDelete}
        onDismiss={() => {
          setDeleting(null);
          setDeleteError('');
        }}
      />
    </div>
  );
}
