import { NavLink, Outlet } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import Icon from '../components/ui/Icon';
import Avatar from '../components/ui/Avatar';
import { useAuth } from '../context/AuthContext';

const items = [
  { to: '/account', label: 'Dashboard', icon: 'dashboard', end: true },
  { to: '/account/bookings', label: 'My Bookings', icon: 'calendar' },
  { to: '/account/reviews', label: 'My Reviews', icon: 'star' },
  { to: '/account/profile', label: 'Profile', icon: 'user' },
  { to: '/account/password', label: 'Password', icon: 'lock' },
  { to: '/account/close', label: 'Close Account', icon: 'shield' },
];

// Shell for every signed-in customer page: public navbar/footer around a
// consistent account sidebar (a horizontal scroller on small screens).
export default function AccountLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="layout">
      <Navbar />
      <main className="layout-main">
        <div className="container account-shell">
          <aside className="account-sidebar" aria-label="My Account">
            <div className="account-sidebar-user">
              <Avatar src={user?.profileImage} name={user?.name} className="account-avatar" decorative />
              <div>
                <strong>{user?.name}</strong>
                <span>{user?.email}</span>
              </div>
            </div>
            <nav className="account-nav">
              {items.map(({ to, label, icon, end }) => (
                <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? 'active' : '')}>
                  <Icon name={icon} size={18} />
                  {label}
                </NavLink>
              ))}
              <button type="button" className="account-nav-logout" onClick={logout}>
                <Icon name="logout" size={18} />
                Log out
              </button>
            </nav>
          </aside>
          <section className="account-content">
            <Outlet />
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
