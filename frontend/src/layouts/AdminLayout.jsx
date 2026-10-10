import { NavLink, Outlet } from 'react-router-dom';
import AdminHeader from '../components/admin/AdminHeader';
import Icon from '../components/ui/Icon';

const navItems = [
  { to: '/admin', label: 'Dashboard', icon: 'dashboard', end: true },
  { to: '/admin/hotels', label: 'Hotels', icon: 'building' },
  { to: '/admin/rooms', label: 'Rooms', icon: 'bed' },
  { to: '/admin/bookings', label: 'Bookings', icon: 'calendar' },
  { to: '/admin/users', label: 'Users', icon: 'guests' },
  { to: '/admin/reviews', label: 'Reviews', icon: 'star' },
];

const accountItems = [{ to: '/admin/profile', label: 'Admin profile', icon: 'user' }];

export default function AdminLayout() {
  return (
    <div className="admin-root">
      <AdminHeader />
      <div className="admin-shell">
        <aside className="admin-sidebar">
          <span className="admin-sidebar-label">Manage</span>
          {navItems.map(({ to, label, icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => (isActive ? 'active' : '')}
            >
              <Icon name={icon} size={18} />
              {label}
            </NavLink>
          ))}
          <span className="admin-sidebar-label">Account</span>
          {accountItems.map(({ to, label, icon }) => (
            <NavLink key={to} to={to} className={({ isActive }) => (isActive ? 'active' : '')}>
              <Icon name={icon} size={18} />
              {label}
            </NavLink>
          ))}
        </aside>

        <div className="admin-main">
          <div className="admin-content">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}
