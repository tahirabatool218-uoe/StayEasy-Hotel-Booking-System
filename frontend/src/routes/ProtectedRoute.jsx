import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ADMIN_HOME } from '../utils/auth';

// User-only guard for the customer experience (booking flow + My Account).
//   guest  -> /login, remembering the exact location (including ?query) so the
//             person returns to the same booking step after signing in
//   admin  -> Admin Dashboard: admins use their own panel, not customer pages
export default function ProtectedRoute() {
  const { isAuthenticated, isAdmin, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="page-loading">Checking your session…</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (isAdmin) {
    return <Navigate to={ADMIN_HOME} replace />;
  }

  return <Outlet />;
}
