import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import Notice from '../components/ui/Notice';

// One-shot message handed over through router state (e.g. after closing an account).
export default function PublicLayout() {
  const location = useLocation();
  const [dismissedKey, setDismissedKey] = useState(null);
  const notice = location.state?.notice;

  return (
    <div className="layout">
      <Navbar />
      {notice && dismissedKey !== location.key && (
        <div className="container flash-notice">
          <Notice type="success" onDismiss={() => setDismissedKey(location.key)}>{notice}</Notice>
        </div>
      )}
      <main className="layout-main">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
