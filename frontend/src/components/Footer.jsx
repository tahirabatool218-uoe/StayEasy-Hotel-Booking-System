import { Link } from 'react-router-dom';
import Icon from './ui/Icon';

const columns = [
  {
    title: 'Explore',
    links: [
      { label: 'Search hotels', to: '/hotels' },
      { label: 'How it works', to: '/#how-it-works' },
      { label: 'Popular destinations', to: '/#destinations' },
    ],
  },
  {
    title: 'Account',
    links: [
      { label: 'Log in', to: '/login' },
      { label: 'Create an account', to: '/register' },
      { label: 'My bookings', to: '/account/bookings' },
    ],
  },
  {
    title: 'Support',
    links: [
      { label: 'Help centre', to: '/#' },
      { label: 'Cancellation options', to: '/#' },
      { label: 'Contact support', to: '/#' },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <div className="footer-top">
          <div className="footer-brand">
            <Link to="/" className="navbar-brand">
              <span className="navbar-brand-mark">S</span>
              StayEasy
            </Link>
            <p>
              Straightforward hotel booking — transparent pricing, verified listings, and support
              whenever you need it.
            </p>
            <p className="footer-contact">
              <Icon name="headset" size={16} /> support@stayeasy.example
            </p>
          </div>

          <div className="footer-columns">
            {columns.map((col) => (
              <div key={col.title} className="footer-column">
                <h4>{col.title}</h4>
                <ul>
                  {col.links.map((link) => (
                    <li key={link.label}>
                      <Link to={link.to}>{link.label}</Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} StayEasy Hotel Booking</span>
          <span>Built on the MERN stack</span>
        </div>
      </div>
    </footer>
  );
}
