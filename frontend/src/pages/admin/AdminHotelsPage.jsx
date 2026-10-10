import { useCallback, useEffect, useState } from 'react';
import adminService from '../../services/adminService';
import hotelService from '../../services/hotelService';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import ConfirmDialog from '../../components/admin/ConfirmDialog';
import DataTable from '../../components/admin/DataTable';
import HotelFormModal from '../../components/admin/HotelFormModal';
import Pagination from '../../components/hotels/Pagination';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import Icon from '../../components/ui/Icon';
import Spinner from '../../components/ui/Spinner';
import { formatPrice } from '../../utils/booking';
import { getApiError } from '../../utils/errors';

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'name_asc', label: 'Name (A–Z)' },
  { value: 'price_asc', label: 'Price (low to high)' },
  { value: 'price_desc', label: 'Price (high to low)' },
  { value: 'rating_desc', label: 'Rating (high to low)' },
];

const ACTIVE_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'true', label: 'Visible' },
  { value: 'false', label: 'Hidden' },
];

export default function AdminHotelsPage() {
  const [result, setResult] = useState({ hotels: [], page: 1, totalPages: 0, total: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [city, setCity] = useState('');
  const [isActive, setIsActive] = useState('');
  const [sort, setSort] = useState('newest');
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

  // Typing in the search box should not fire a request per keystroke, so the
  // text inputs commit on a short delay while the selects apply immediately.
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [debouncedCity, setDebouncedCity] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedCity(city), 400);
    return () => clearTimeout(timer);
  }, [city]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await adminService.getHotels({ search: debouncedSearch, city: debouncedCity, isActive, sort, page });
      setResult(data);
    } catch (err) {
      setError(getApiError(err, 'Could not load hotels. Please try again.'));
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, debouncedCity, isActive, sort, page]);

  useEffect(() => {
    load();
  }, [load]);

  // Any filter change invalidates the current page number, otherwise changing a
  // filter on page 3 can land on an empty page. Done in the change handlers
  // rather than in an effect, so it does not cost an extra render pass.
  const resetToFirstPage = () => setPage(1);

  const openCreate = () => {
    setEditing(null);
    setFormError('');
    setFormOpen(true);
  };

  const openEdit = (hotel) => {
    setEditing(hotel);
    setFormError('');
    setFormOpen(true);
  };

  const handleSubmit = async (payload) => {
    setSaving(true);
    setFormError('');
    try {
      if (editing) {
        await hotelService.updateHotel(editing._id, payload);
        setNotice(`“${payload.name}” was updated.`);
      } else {
        await hotelService.createHotel(payload);
        setNotice(`“${payload.name}” was created.`);
      }
      setFormOpen(false);
      setEditing(null);
      await load();
    } catch (err) {
      setFormError(getApiError(err, 'Could not save this hotel. Please check the fields and try again.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setConfirmingDelete(true);
    setDeleteError('');
    try {
      await hotelService.deleteHotel(deleting._id);
      setNotice(`“${deleting.name}” was deleted.`);
      setDeleting(null);
      await load();
    } catch (err) {
      // Close the dialog so the message is readable in the page flow rather
      // than hidden behind the overlay.
      setDeleteError(getApiError(err, 'Could not delete this hotel. Please try again.'));
      setDeleting(null);
    } finally {
      setConfirmingDelete(false);
    }
  };

  const columns = [
    {
      key: 'name',
      header: 'Hotel',
      render: (hotel) => (
        <span className="admin-thumb-cell">
          {hotel.images?.[0] ? <img src={hotel.images[0]} alt="" loading="lazy" /> : <span className="admin-thumb-empty"><Icon name="image" size={16} /></span>}
          <span>
            <span className="admin-cell-strong">{hotel.name}</span>
            <span className="admin-cell-sub">
              {[hotel.location, hotel.city, hotel.country].filter(Boolean).join(', ')}
            </span>
          </span>
        </span>
      ),
    },
    {
      key: 'roomCount',
      header: 'Rooms',
      numeric: true,
      render: (hotel) => hotel.roomCount ?? 0,
    },
    {
      key: 'pricePerNight',
      header: 'From',
      numeric: true,
      render: (hotel) => formatPrice(hotel.pricePerNight),
    },
    {
      key: 'rating',
      header: 'Rating',
      numeric: true,
      render: (hotel) => (
        <span className="admin-rating">
          <Icon name="star" size={14} />
          {hotel.rating}
        </span>
      ),
    },
    {
      key: 'isActive',
      header: 'Visibility',
      render: (hotel) => (
        <Badge tone={hotel.isActive ? 'accent' : 'neutral'}>{hotel.isActive ? 'Visible' : 'Hidden'}</Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (hotel) => (
        <div className="admin-cell-actions">
          <Button size="sm" variant="outline" onClick={() => openEdit(hotel)}>
            Edit
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() => {
              setDeleting(hotel);
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
      <AdminPageHeader
        title="Hotels"
        description="Every hotel, including the ones hidden from the public site."
      >
        <Button onClick={openCreate}>Add hotel</Button>
      </AdminPageHeader>

      {notice && <p className="admin-notice admin-notice-success">{notice}</p>}
      {deleteError && <p className="admin-notice admin-notice-error">{deleteError}</p>}

      <div className="admin-toolbar">
        <div className="admin-toolbar-search">
          <span className="ui-field-icon">
            <Icon name="search" size={16} />
          </span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, description or location"
            aria-label="Search hotels"
          />
        </div>

        <div className="admin-field">
          <label className="admin-field-label" htmlFor="hotel-filter-city">
            City
          </label>
          <input
            id="hotel-filter-city"
            type="search"
            value={city}
            onChange={(e) => {
              setCity(e.target.value);
              resetToFirstPage();
            }}
            placeholder="Any city"
            aria-label="Filter by city"
          />
        </div>

        <div className="admin-field">
          <label className="admin-field-label" htmlFor="hotel-filter-status">
            Visibility
          </label>
          <select
            id="hotel-filter-status"
            value={isActive}
            onChange={(e) => {
              setIsActive(e.target.value);
              resetToFirstPage();
            }}
          >
            {ACTIVE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="admin-field">
          <label className="admin-field-label" htmlFor="hotel-sort">
            Sort
          </label>
          <select
            id="hotel-sort"
            value={sort}
            onChange={(e) => {
              setSort(e.target.value);
              resetToFirstPage();
            }}
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="admin-page-state">
          <Spinner size="lg" label="Loading hotels" />
        </div>
      ) : error ? (
        <ErrorState description={error} onRetry={load} />
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={result.hotels}
            empty={
              <EmptyState
                title="No hotels found"
                description={
                  search || city || isActive
                    ? 'No hotel matches these filters. Try clearing them.'
                    : 'Add your first hotel to get started.'
                }
                action={
                  <Button onClick={openCreate}>Add hotel</Button>
                }
              />
            }
          />

          <div className="admin-table-toolbar">
            <span className="admin-toolbar-count">
              {result.total} hotel{result.total === 1 ? '' : 's'}
            </span>
            <Pagination page={result.page} totalPages={result.totalPages} onPageChange={setPage} />
          </div>
        </>
      )}

      <HotelFormModal
        hotel={editing}
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
        title={`Delete “${deleting?.name}”?`}
        description="This permanently removes the hotel and cannot be undone. A hotel that has bookings, reviews or rooms can't be deleted — to take it off the public site instead, edit it and untick “Visible on the public site”."
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
