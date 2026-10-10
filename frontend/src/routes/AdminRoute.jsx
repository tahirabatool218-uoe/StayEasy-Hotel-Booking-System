import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Guards the /admin/* route tree. Mirrors the backend's authorize('admin')
// middleware (src/middleware/roleMiddleware.js): logged-in but non-admin
// users are redirected to their own account rather than shown an admin shell.
export default function AdminRoute() {
  const { isAuthenticated, isAdmin, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="page-loading">Checking your session…</div>;
  }

  if (!isAuthenticated) {
    // Remember where they were headed, so signing in lands them back on the
    // admin page they asked for rather than the homepage.
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (!isAdmin) {
    return <Navigate to="/account" replace />;
  }

  return <Outlet />;
}
