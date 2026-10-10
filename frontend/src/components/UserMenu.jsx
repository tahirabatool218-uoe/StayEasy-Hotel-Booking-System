import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Icon from './ui/Icon';
import Avatar from './ui/Avatar';

// Kept short on purpose: bookings, reviews and password live inside the
// dashboard's own sidebar.
const USER_LINKS = [
  { to: '/account', label: 'Dashboard', icon: 'dashboard' },
  { to: '/account/profile', label: 'Profile', icon: 'user' },
];

const ADMIN_LINKS = [
  { to: '/admin', label: 'Dashboard', icon: 'dashboard' },
  { to: '/admin/profile', label: 'Profile', icon: 'user' },
];

// Account dropdown for the public navbar: avatar + first name open a card with
// the person's details, their account links and Log out (the pattern most
// booking sites use). Closes on outside press, Escape (focus returns to the
// button) and when a link or Log out inside it is used.
export default function UserMenu() {
  const { user, isAdmin, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const displayName = user?.name || 'Your account';
  const firstName = displayName.split(' ')[0];
  const links = isAdmin ? ADMIN_LINKS : USER_LINKS;

  return (
    <div className="user-menu" ref={wrapperRef}>
      <button
        ref={buttonRef}
        type="button"
        className={`user-menu-btn ${open ? 'is-open' : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${displayName}`}
        onClick={() => setOpen((prev) => !prev)}
      >
        <Avatar src={user?.profileImage} name={displayName} size={32} decorative />
        <span className="user-menu-name">{firstName}</span>
        <Icon name="chevronDown" size={16} className="user-menu-chevron" />
      </button>

      {open && (
        <div className="user-menu-card" role="menu" aria-label="Account">
          <div className="user-menu-head">
            <Avatar src={user?.profileImage} name={displayName} size={52} decorative />
            <div className="user-menu-meta">
              <span className="user-menu-fullname">{displayName}</span>
              {user?.email && <span className="user-menu-email">{user.email}</span>}
              <span className="user-menu-role">{isAdmin ? 'Administrator' : 'Guest'}</span>
            </div>
          </div>

          <div className="user-menu-body">
            {links.map(({ to, label, icon }) => (
              <Link key={to} to={to} role="menuitem" className="user-menu-item" onClick={() => setOpen(false)}>
                <Icon name={icon} size={18} />
                {label}
              </Link>
            ))}
          </div>

          <div className="user-menu-body user-menu-foot">
            <button
              type="button"
              role="menuitem"
              className="user-menu-item is-danger"
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
  );
}
