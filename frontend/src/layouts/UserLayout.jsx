import { Outlet } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

// Shares the public chrome (same navbar/footer) but is kept as its own
// layout so authenticated-only pages (My Bookings, Profile) have a place
// to grow user-specific chrome (e.g. account nav) without touching
// PublicLayout.
export default function UserLayout() {
  return (
    <div className="layout">
      <Navbar />
      <main className="layout-main">
        <div className="container">
          <Outlet />
        </div>
      </main>
      <Footer />
    </div>
  );
}
