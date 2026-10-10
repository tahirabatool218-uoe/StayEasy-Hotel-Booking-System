import { useCallback, useEffect, useState } from 'react';
import reviewService from '../../services/reviewService';
import UserCell from '../../components/admin/UserCell';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import ConfirmDialog from '../../components/admin/ConfirmDialog';
import DataTable from '../../components/admin/DataTable';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import Icon from '../../components/ui/Icon';
import Spinner from '../../components/ui/Spinner';
import { formatShortDate } from '../../utils/booking';
import { getApiError } from '../../utils/errors';

const STATUS_OPTIONS = [
  { value: '', label: 'All reviews' },
  { value: 'visible', label: 'Visible' },
  { value: 'hidden', label: 'Hidden' },
];

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [rowError, setRowError] = useState('');

  const [updatingId, setUpdatingId] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setReviews(await reviewService.getAllReviews());
    } catch (err) {
      setError(getApiError(err, 'Could not load reviews. Please try again.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleStatusChange = async (review, nextStatus) => {
    setUpdatingId(review._id);
    setRowError('');
    try {
      const updated = await reviewService.setReviewStatus(review._id, nextStatus);
      setReviews((prev) => prev.map((r) => (r._id === review._id ? { ...r, ...updated } : r)));
      setNotice(nextStatus === 'hidden' ? 'Review hidden from the hotel page.' : 'Review is visible again.');
    } catch (err) {
      setRowError(getApiError(err, 'Could not change this review.'));
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setConfirmingDelete(true);
    setDeleteError('');
    try {
      await reviewService.deleteReview(deleting._id);
      setNotice('Review deleted.');
      setDeleting(null);
      await load();
    } catch (err) {
      setDeleteError(getApiError(err, 'Could not delete this review. Please try again.'));
      setDeleting(null);
    } finally {
      setConfirmingDelete(false);
    }
  };

  // GET /api/reviews is unpaginated, so filtering happens here.
  const term = search.trim().toLowerCase();
  const visible = reviews.filter((review) => {
    if (statusFilter && review.status !== statusFilter) return false;
    if (!term) return true;
    const guest = review.user && typeof review.user === 'object' ? review.user : null;
    return [guest?.name, guest?.email, review.hotel?.name, review.comment]
      .filter(Boolean)
      .some((field) => String(field).toLowerCase().includes(term));
  });

  const columns = [
    {
      key: 'guest',
      header: 'Guest',
      render: (review) => <UserCell user={review.user} />,
    },
    {
      key: 'hotel',
      header: 'Hotel',
      render: (review) => (
        <>
          {review.hotel?.name || 'Deleted hotel'}
          {review.hotel?.city && <span className="admin-cell-sub">{review.hotel.city}</span>}
        </>
      ),
    },
    {
      key: 'rating',
      header: 'Rating',
      numeric: true,
      render: (review) => (
        <span className="admin-rating">
          <Icon name="star" size={14} />
          {review.rating}
        </span>
      ),
    },
    {
      key: 'comment',
      header: 'Comment',
      render: (review) => (
        <span className="admin-comment-cell" title={review.comment}>
          {review.comment}
        </span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Posted',
      render: (review) => formatShortDate(review.createdAt),
    },
    {
      key: 'status',
      header: 'Visibility',
      render: (review) => (
        <Badge tone={review.status === 'visible' ? 'accent' : 'neutral'}>
          {review.status === 'visible' ? 'Visible' : 'Hidden'}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (review) => (
        <div className="admin-cell-actions">
          <Button
            size="sm"
            variant="outline"
            loading={updatingId === review._id}
            onClick={() => handleStatusChange(review, review.status === 'visible' ? 'hidden' : 'visible')}
          >
            {review.status === 'visible' ? 'Hide' : 'Show'}
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() => {
              setDeleting(review);
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
      <AdminPageHeader title="Reviews" description="Moderate what guests have written about their stays." />

      {notice && <p className="admin-notice admin-notice-success">{notice}</p>}
      {rowError && <p className="admin-notice admin-notice-error">{rowError}</p>}
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
            placeholder="Search guest, hotel or comment"
            aria-label="Search reviews"
          />
        </div>

        <div className="admin-field">
          <label className="admin-field-label" htmlFor="review-filter-status">
            Visibility
          </label>
          <select id="review-filter-status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <span className="admin-toolbar-count">
          {visible.length} of {reviews.length} review{reviews.length === 1 ? '' : 's'}
        </span>
      </div>

      {loading ? (
        <div className="admin-page-state">
          <Spinner size="lg" label="Loading reviews" />
        </div>
      ) : error ? (
        <ErrorState description={error} onRetry={load} />
      ) : (
        <DataTable
          columns={columns}
          rows={visible}
          empty={
            <EmptyState
              title="No reviews found"
              description={
                search || statusFilter ? 'No review matches these filters. Try clearing them.' : 'Guests have not reviewed any stays yet.'
              }
            />
          }
        />
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete this review?"
        description="This removes it permanently and the hotel's average rating is recalculated straight away."
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
