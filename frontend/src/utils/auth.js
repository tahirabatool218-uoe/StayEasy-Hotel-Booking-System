// Where each role lands, and where a login/redirect may send them back to.
export const ADMIN_HOME = '/admin';
export const USER_HOME = '/account';

const isAdminPath = (path) => path === ADMIN_HOME || path.startsWith(`${ADMIN_HOME}/`);

// `from` is the react-router location a guard stored in state before sending
// the visitor to /login. The booking flow relies on it: /booking?hotel=…&room=…
// (with its query string) is restored exactly after authentication.
//   admin  -> their original admin page, otherwise the Admin Dashboard
//   user   -> their original page (e.g. the booking step), otherwise the dashboard
// A role never gets sent to the other role's area (it would only bounce again).
export const getPostLoginPath = (user, from) => {
  const isAdmin = user?.role === 'admin';
  const target = from?.pathname ? `${from.pathname}${from.search || ''}${from.hash || ''}` : '';

  if (isAdmin) return target && isAdminPath(from.pathname) ? target : ADMIN_HOME;
  if (!target || isAdminPath(from.pathname) || ['/login', '/register'].includes(from.pathname)) return USER_HOME;
  return target;
};

export const getHomeForUser = (user) => (user?.role === 'admin' ? ADMIN_HOME : USER_HOME);
