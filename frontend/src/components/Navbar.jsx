import { useEffect, useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { ADMIN_HOME, USER_HOME } from '../utils/auth';
import Icon from './ui/Icon';
import UserMenu from './UserMenu';
import Avatar from './ui/Avatar';

const navItems = [
  { to: '/', label: 'Home', end: true },
  { to: '/hotels', label: 'Hotels' },
];

const linkClass = ({ isActive }) => (isActive ? 'active' : '');

// Public navigation. Signed-in people get exactly ONE account entry:
//   user  -> "My Account" (dashboard, bookings, reviews, profile live inside it)
//   admin -> "Admin Panel" (a separate layout with its own navigation)
// so the public bar never duplicates My bookings / Profile links.
export default function Navbar() {
  const { isAuthenticated, isAdmin, user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKeyDown = (event) => event.key === 'Escape' && setMenuOpen(false);
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [menuOpen]);

  const closeMenu = () => setMenuOpen(false);
  const accountTo = isAdmin ? ADMIN_HOME : USER_HOME;
  const accountLabel = isAdmin ? 'Admin Panel' : 'My Account';
  const firstName = user?.name?.split(' ')[0];

  return (
    <header className={`navbar ${scrolled ? 'is-scrolled' : ''}`}>
      <div className="container navbar-inner">
        <Link to="/" className="navbar-brand" onClick={closeMenu}>
          <span className="navbar-brand-mark">S</span>
          StayEasy
        </Link>

        <nav className="navbar-links" aria-label="Primary">
          {navItems.map(({ to, label, end }) => (
            <NavLink key={to} to={to} end={end} className={linkClass}>
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="navbar-actions">
          <button
            type="button"
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
            title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
          >
            <Icon name={isDark ? 'sun' : 'moon'} size={18} />
          </button>

          {isAuthenticated ? (
            <div className="navbar-user">
              <UserMenu />
            </div>
          ) : (
            <div className="navbar-auth">
              <Link to="/login" className="ui-btn ui-btn-ghost ui-btn-sm">
                <span className="ui-btn-label">Log in</span>
              </Link>
              <Link to="/register" className="ui-btn ui-btn-primary ui-btn-sm">
                <span className="ui-btn-label">Sign up</span>
              </Link>
            </div>
          )}

          <button
            type="button"
            className="navbar-toggle"
            aria-label="Toggle navigation menu"
            aria-expanded={menuOpen}
            aria-controls="navbar-mobile-panel"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <Icon name={menuOpen ? 'close' : 'menu'} size={20} />
          </button>
        </div>
      </div>

      <div id="navbar-mobile-panel" className={`navbar-mobile ${menuOpen ? 'open' : ''}`}>
        <nav className="navbar-mobile-links" aria-label="Mobile">
          {navItems.map(({ to, label, end }) => (
            <NavLink key={to} to={to} end={end} className={linkClass} onClick={closeMenu} tabIndex={menuOpen ? 0 : -1}>
              {label}
            </NavLink>
          ))}
          {isAuthenticated && (
            <NavLink to={accountTo} className={linkClass} onClick={closeMenu} tabIndex={menuOpen ? 0 : -1}>
              <Avatar src={user?.profileImage} name={user?.name} size={26} decorative />
              <span>{accountLabel}{firstName ? ` · ${firstName}` : ''}</span>
            </NavLink>
          )}
        </nav>
        <div className="navbar-mobile-actions">
          {isAuthenticated ? (
            <button type="button" className="ui-btn ui-btn-outline ui-btn-block" onClick={() => { closeMenu(); logout(); }} tabIndex={menuOpen ? 0 : -1}>
              <span className="ui-btn-label">Log out</span>
            </button>
          ) : (
            <>
              <Link to="/login" className="ui-btn ui-btn-outline ui-btn-block" onClick={closeMenu} tabIndex={menuOpen ? 0 : -1}>
                <span className="ui-btn-label">Log in</span>
              </Link>
              <Link to="/register" className="ui-btn ui-btn-primary ui-btn-block" onClick={closeMenu} tabIndex={menuOpen ? 0 : -1}>
                <span className="ui-btn-label">Sign up</span>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
