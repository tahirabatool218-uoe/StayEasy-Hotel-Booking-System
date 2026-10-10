import { useCallback, useEffect, useState } from 'react';
import adminService from '../../services/adminService';
import { useAuth } from '../../context/AuthContext';
import AdminPageHeader from '../../components/admin/AdminPageHeader';
import ConfirmDialog from '../../components/admin/ConfirmDialog';
import DataTable from '../../components/admin/DataTable';
import Pagination from '../../components/hotels/Pagination';
import Badge from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import Icon from '../../components/ui/Icon';
import Spinner from '../../components/ui/Spinner';
import { formatShortDate } from '../../utils/booking';
import { getApiError } from '../../utils/errors';

const ROLE_OPTIONS = [
  { value: '', label: 'All roles' },
  { value: 'user', label: 'Guests' },
  { value: 'admin', label: 'Admins' },
];

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth();
  const [result, setResult] = useState({ users: [], page: 1, totalPages: 0, total: 0 });
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [rowError, setRowError] = useState('');

  const [updatingId, setUpdatingId] = useState(null);
  // Deactivate / reactivate (PUT /admin/users/:id/status). Hard deletion is not
  // offered: the backend refuses it for any user with bookings or reviews.
  const [statusTarget, setStatusTarget] = useState(null); // { user, nextActive }
  const [changingStatus, setChangingStatus] = useState(false);

  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await adminService.getUsers({ search: debouncedSearch, role: roleFilter, page });
      setResult(data);
    } catch (err) {
      setError(getApiError(err, 'Could not load users. Please try again.'));
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, roleFilter, page]);

  useEffect(() => {
    load();
  }, [load]);

  const resetToFirstPage = () => setPage(1);

  const handleRoleChange = async (target, nextRole) => {
    setUpdatingId(target._id);
    setRowError('');
    try {
      await adminService.updateUserRole(target._id, nextRole);
      setNotice(`${target.name} is now ${nextRole === 'admin' ? 'an admin' : 'a guest'}.`);
      await load();
    } catch (err) {
      setRowError(getApiError(err, 'Could not change this role.'));
    } finally {
      setUpdatingId(null);
    }
  };

  const handleStatusChange = async () => {
    if (!statusTarget || changingStatus) return;
    const { user: target, nextActive } = statusTarget;
    setChangingStatus(true);
    setRowError('');
    setNotice('');
    try {
      await adminService.updateUserStatus(target._id, nextActive);
      setNotice(`${target.name} was ${nextActive ? 'reactivated' : 'deactivated'}.`);
      await load();
    } catch (err) {
      // 400 own account, 409 last active admin / closed account, 404 gone.
      setRowError(getApiError(err, `Could not ${nextActive ? 'reactivate' : 'deactivate'} this user.`));
    } finally {
      setChangingStatus(false);
      setStatusTarget(null);
    }
  };

  const columns = [
    {
      key: 'name',
      header: 'User',
      render: (row) => (
        <>
          <span className="admin-cell-strong">
            {row.name}
            {row._id === currentUser?._id && <span className="admin-cell-sub">That’s you</span>}
          </span>
          <span className="admin-cell-sub">{row.email}</span>
        </>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: (row) => <Badge tone={row.role === 'admin' ? 'accent' : 'neutral'}>{row.role}</Badge>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) =>
        row.closedAt ? (
          <>
            <Badge tone="neutral">Closed</Badge>
            <span className="admin-cell-sub">Closed {formatShortDate(row.closedAt)}</span>
          </>
        ) : (
          <Badge tone={row.isActive ? 'accent' : 'danger'}>{row.isActive ? 'Active' : 'Deactivated'}</Badge>
        ),
    },
    {
      key: 'bookingCount',
      header: 'Bookings',
      numeric: true,
      render: (row) => row.bookingCount ?? 0,
    },
    {
      key: 'createdAt',
      header: 'Joined',
      render: (row) => formatShortDate(row.createdAt),
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (row) => {
        const isSelf = row._id === currentUser?._id;
        const closed = Boolean(row.closedAt);
        return (
          <div className="admin-cell-actions">
            <Button
              size="sm"
              variant="outline"
              // The backend refuses self role changes and closed accounts, so
              // the control is disabled rather than failing after a round trip.
              disabled={isSelf || closed || updatingId === row._id}
              onClick={() => handleRoleChange(row, row.role === 'admin' ? 'user' : 'admin')}
            >
              Make {row.role === 'admin' ? 'guest' : 'admin'}
            </Button>
            {row.isActive ? (
              <Button
                size="sm"
                variant="danger"
                disabled={isSelf || closed}
                title={isSelf ? 'You cannot deactivate your own account' : closed ? 'Closed by the guest' : undefined}
                onClick={() => setStatusTarget({ user: row, nextActive: false })}
              >
                Deactivate
              </Button>
            ) : (
              <Button
                size="sm"
                variant="primary"
                disabled={closed}
                title={closed ? 'This account was closed by the guest and cannot be changed' : undefined}
                onClick={() => setStatusTarget({ user: row, nextActive: true })}
              >
                Reactivate
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div className="admin-page">
      <AdminPageHeader title="Users" description="Guests and administrators who can sign in to StayEasy." />

      {notice && <p className="admin-notice admin-notice-success" role="status">{notice}</p>}
      {rowError && <p className="admin-notice admin-notice-error" role="alert">{rowError}</p>}

      <div className="admin-toolbar">
        <div className="admin-toolbar-search">
          <span className="ui-field-icon">
            <Icon name="search" size={16} />
          </span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email"
            aria-label="Search users"
          />
        </div>

        <div className="admin-field">
          <label className="admin-field-label" htmlFor="user-filter-role">
            Role
          </label>
          <select
            id="user-filter-role"
            value={roleFilter}
            onChange={(e) => {
              setRoleFilter(e.target.value);
              resetToFirstPage();
            }}
          >
            {ROLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="admin-page-state">
          <Spinner size="lg" label="Loading users" />
        </div>
      ) : error ? (
        <ErrorState description={error} onRetry={load} />
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={result.users}
            empty={
              <EmptyState
                title="No users found"
                description={search || roleFilter ? 'No user matches these filters. Try clearing them.' : 'No users yet.'}
              />
            }
          />

          <div className="admin-table-toolbar">
            <span className="admin-toolbar-count">
              {result.total} user{result.total === 1 ? '' : 's'}
            </span>
            <Pagination page={result.page} totalPages={result.totalPages} onPageChange={setPage} />
          </div>
        </>
      )}

      <ConfirmDialog
        open={Boolean(statusTarget)}
        title={statusTarget?.nextActive ? `Reactivate ${statusTarget?.user.name}?` : `Deactivate ${statusTarget?.user.name}?`}
        description={
          statusTarget?.nextActive
            ? 'They will be able to sign in again.'
            : 'They will be signed out and blocked from signing in. Their bookings and reviews are kept. You can reactivate the account later.'
        }
        confirmLabel={statusTarget?.nextActive ? 'Yes, reactivate' : 'Yes, deactivate'}
        confirmVariant={statusTarget?.nextActive ? 'primary' : 'danger'}
        submitting={changingStatus}
        onConfirm={handleStatusChange}
        onDismiss={() => setStatusTarget(null)}
      />
    </div>
  );
}
