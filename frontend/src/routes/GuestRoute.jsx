import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getPostLoginPath } from '../utils/auth';

// Guest-only guard for /login and /register. A signed-in visitor is sent to
// where they belong (honouring a pending booking step, if there is one) instead
// of seeing a sign-in form they do not need.
export default function GuestRoute() {
  const { isAuthenticated, user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="page-loading">Checking your session…</div>;
  }

  if (isAuthenticated) {
    return <Navigate to={getPostLoginPath(user, location.state?.from)} replace />;
  }

  return <Outlet />;
}
