import { useCallback, useEffect, useState } from 'react';
import adminService from '../../services/adminService';
import roomService from '../../services/roomService';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import ConfirmDialog from '../../components/admin/ConfirmDialog';
import DataTable from '../../components/admin/DataTable';
import RoomFormModal from '../../components/admin/RoomFormModal';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import Icon from '../../components/ui/Icon';
import Spinner from '../../components/ui/Spinner';
import { formatPrice } from '../../utils/booking';
import { getApiError } from '../../utils/errors';

const STATUS_TONES = {
  available: 'accent',
  maintenance: 'warning',
  inactive: 'neutral',
};

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'available', label: 'Available' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'inactive', label: 'Inactive' },
];

const hotelName = (room) => room.hotel?.name || 'Deleted hotel';

export default function AdminRoomsPage() {
  const [rooms, setRooms] = useState([]);
  const [hotels, setHotels] = useState([]);
  const [hotelFilter, setHotelFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [deleting, setDeleting] = useState(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // The room list has no pagination, so filtering happens server-side via
      // the query params GET /api/rooms already supports.
      const [roomData, hotelData] = await Promise.all([
        roomService.getRooms({ hotel: hotelFilter, status: statusFilter }),
        adminService.getHotels({ limit: 100, sort: 'name_asc' }),
      ]);
      setRooms(roomData);
      setHotels(hotelData.hotels);
    } catch (err) {
      setError(getApiError(err, 'Could not load rooms. Please try again.'));
    } finally {
      setLoading(false);
    }
  }, [hotelFilter, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setFormError('');
    setFormOpen(true);
  };

  const openEdit = (room) => {
    setEditing(room);
    setFormError('');
    setFormOpen(true);
  };

  const handleSubmit = async (payload) => {
    setSaving(true);
    setFormError('');
    try {
      if (editing) {
        await roomService.updateRoom(editing._id, payload);
        setNotice(`Room ${payload.roomNumber} was updated.`);
      } else {
        await roomService.createRoom(payload);
        setNotice(`Room ${payload.roomNumber} was created.`);
      }
      setFormOpen(false);
      setEditing(null);
      await load();
    } catch (err) {
      setFormError(getApiError(err, 'Could not save this room. Please check the fields and try again.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setConfirmingDelete(true);
    setDeleteError('');
    try {
      await roomService.deleteRoom(deleting._id);
      setNotice(`Room ${deleting.roomNumber} was deleted.`);
      setDeleting(null);
      await load();
    } catch (err) {
      setDeleteError(getApiError(err, 'Could not delete this room. Please try again.'));
      setDeleting(null);
    } finally {
      setConfirmingDelete(false);
    }
  };

  const columns = [
    {
      key: 'roomNumber',
      header: 'Room',
      render: (room) => (
        <span className="admin-thumb-cell">
          {room.images?.[0] ? <img src={room.images[0]} alt="" loading="lazy" /> : <span className="admin-thumb-empty"><Icon name="image" size={16} /></span>}
          <span>
            <span className="admin-cell-strong">Room {room.roomNumber}</span>
            <span className="admin-cell-sub">{room.roomType}</span>
          </span>
        </span>
      ),
    },
    {
      key: 'hotel',
      header: 'Hotel',
      render: (room) => (
        <>
          {hotelName(room)}
          {room.hotel?.city && <span className="admin-cell-sub">{room.hotel.city}</span>}
        </>
      ),
    },
    {
      key: 'capacity',
      header: 'Sleeps',
      numeric: true,
      render: (room) => `${room.capacity} guest${room.capacity === 1 ? '' : 's'}`,
    },
    {
      key: 'pricePerNight',
      header: 'Nightly rate',
      numeric: true,
      render: (room) => formatPrice(room.pricePerNight),
    },
    {
      key: 'status',
      header: 'Status',
      render: (room) => <Badge tone={STATUS_TONES[room.status] || 'neutral'}>{room.status}</Badge>,
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (room) => (
        <div className="admin-cell-actions">
          <Button size="sm" variant="outline" onClick={() => openEdit(room)}>
            Edit
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() => {
              setDeleting(room);
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
      <AdminPageHeader title="Rooms" description="Every room across the hotels, with its live booking status.">
        <Button onClick={openCreate}>Add room</Button>
      </AdminPageHeader>

      {notice && <p className="admin-notice admin-notice-success">{notice}</p>}
      {deleteError && <p className="admin-notice admin-notice-error">{deleteError}</p>}

      <div className="admin-toolbar">
        <div className="admin-field">
          <label className="admin-field-label" htmlFor="room-filter-hotel">
            Hotel
          </label>
          <select id="room-filter-hotel" value={hotelFilter} onChange={(e) => setHotelFilter(e.target.value)}>
            <option value="">All hotels</option>
            {hotels.map((hotel) => (
              <option key={hotel._id} value={hotel._id}>
                {hotel.name} — {hotel.city}
              </option>
            ))}
          </select>
        </div>

        <div className="admin-field">
          <label className="admin-field-label" htmlFor="room-filter-status">
            Status
          </label>
          <select id="room-filter-status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="admin-page-state">
          <Spinner size="lg" label="Loading rooms" />
        </div>
      ) : error ? (
        <ErrorState description={error} onRetry={load} />
      ) : (
        <DataTable
          columns={columns}
          rows={rooms}
          empty={
            <EmptyState
              title="No rooms found"
              description={
                hotelFilter || statusFilter
                  ? 'No room matches these filters. Try clearing them.'
                  : 'Add your first room to get started.'
              }
              action={<Button onClick={openCreate}>Add room</Button>}
            />
          }
        />
      )}

      <RoomFormModal
        room={editing}
        hotels={hotels}
        open={formOpen}
        submitting={saving}
        serverError={formError}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSubmit={handleSubmit}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        title={`Delete room ${deleting?.roomNumber}?`}
        description={
          deleting
            ? `This removes it from ${hotelName(deleting)} permanently. A room that has any bookings (including past or cancelled ones) can't be deleted — set its status to inactive instead to stop new bookings.`
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
