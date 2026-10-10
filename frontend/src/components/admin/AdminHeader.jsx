import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import Icon from '../ui/Icon';
import Avatar from '../ui/Avatar';

const SECTION_TITLES = {
  '/admin': 'Dashboard',
  '/admin/hotels': 'Hotels',
  '/admin/rooms': 'Rooms',
  '/admin/bookings': 'Bookings',
  '/admin/users': 'Users',
  '/admin/reviews': 'Reviews',
  '/admin/profile': 'Admin profile',
};

export default function AdminHeader() {
  const { pathname } = useLocation();
  const sectionTitle = SECTION_TITLES[pathname.replace(/\/+$/, '') || '/admin'] || 'Dashboard';
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);
  const buttonRef = useRef(null);

  // Close on outside press and on Escape (returning focus to the trigger).
  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const displayName = user?.name || user?.email || 'Admin';
  const firstName = displayName.split(' ')[0];
  const initial = displayName[0]?.toUpperCase() || 'A';

  return (
    <header className="admin-header">
      <div className="admin-header-inner">
        <div className="admin-header-left">
          <Link to="/admin" className="admin-header-brand" aria-label="StayEasy Admin Panel">
            <span className="navbar-brand-mark">S</span>
            <span className="admin-header-brand-text">
              <span className="admin-header-brand-name">StayEasy</span>
              <span className="admin-header-brand-sub">Admin Panel</span>
            </span>
          </Link>

          <nav className="admin-header-crumbs" aria-label="Breadcrumb">
            <span>Admin</span>
            <Icon name="chevronRight" size={14} />
            <strong aria-current="page">{sectionTitle}</strong>
          </nav>
        </div>

        <div className="admin-header-actions">
          <button
            type="button"
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
            title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            <Icon name={isDark ? 'sun' : 'moon'} size={18} />
          </button>

          <div className="admin-profile" ref={wrapperRef}>
            <button
              ref={buttonRef}
              type="button"
              className={`admin-profile-btn ${open ? 'is-open' : ''}`}
              aria-haspopup="menu"
              aria-expanded={open}
              aria-label="Open profile menu"
              onClick={() => setOpen((prev) => !prev)}
            >
              <Avatar src={user?.profileImage} name={displayName} fallback={initial} decorative />
              <span className="admin-profile-name">{firstName}</span>
              <Icon name="chevronDown" size={16} className="admin-profile-chevron" />
            </button>

            {open && (
              <div className="admin-profile-menu" role="menu" aria-label="Profile">
                <div className="admin-profile-menu-head">
                  <Avatar src={user?.profileImage} name={displayName} fallback={initial} className="admin-profile-menu-avatar" decorative />
                  <div className="admin-profile-menu-meta">
                    <span className="admin-profile-menu-name">{displayName}</span>
                    {user?.email && <span className="admin-profile-menu-email">{user.email}</span>}
                  </div>
                </div>
                <div className="admin-profile-menu-body">
                  <Link to="/admin/profile" role="menuitem" className="admin-profile-menu-item" onClick={() => setOpen(false)}>
                    <Icon name="user" size={18} />
                    Admin profile
                  </Link>
                  <Link to="/" role="menuitem" className="admin-profile-menu-item" onClick={() => setOpen(false)}>
                    <Icon name="compass" size={18} />
                    View public site
                  </Link>
                  <button
                    type="button"
                    role="menuitem"
                    className="admin-profile-menu-item is-danger"
                    onClick={() => {
                      setOpen(false);
                      logout();
                    }}
                  >
                    <Icon name="logout" size={18} />
                    Log out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
