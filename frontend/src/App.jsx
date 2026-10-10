import { Navigate, Routes, Route } from 'react-router-dom';

import PublicLayout from './layouts/PublicLayout';
import AccountLayout from './layouts/AccountLayout';
import AdminLayout from './layouts/AdminLayout';

import ProtectedRoute from './routes/ProtectedRoute';
import GuestRoute from './routes/GuestRoute';
import AdminRoute from './routes/AdminRoute';

import HomePage from './pages/public/HomePage';
import HotelsPage from './pages/public/HotelsPage';
import HotelDetailsPage from './pages/public/HotelDetailsPage';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';

import BookingPage from './pages/public/BookingPage';
import BookingConfirmationPage from './pages/public/BookingConfirmationPage';

import DashboardPage from './pages/account/DashboardPage';
import MyBookingsPage from './pages/account/MyBookingsPage';
import BookingDetailsPage from './pages/account/BookingDetailsPage';
import MyReviewsPage from './pages/account/MyReviewsPage';
import ProfilePage from './pages/account/ProfilePage';
import EditProfilePage from './pages/account/EditProfilePage';
import ChangePasswordPage from './pages/account/ChangePasswordPage';
import CloseAccountPage from './pages/account/CloseAccountPage';

import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import AdminHotelsPage from './pages/admin/AdminHotelsPage';
import AdminRoomsPage from './pages/admin/AdminRoomsPage';
import AdminBookingsPage from './pages/admin/AdminBookingsPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminReviewsPage from './pages/admin/AdminReviewsPage';
import AdminProfilePage from './pages/admin/AdminProfilePage';

import NotFoundPage from './pages/NotFoundPage';

export default function App() {
  return (
    <Routes>
      {/* Public site. Browsing is open to everyone (guests, users and admins). */}
      <Route element={<PublicLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/hotels" element={<HotelsPage />} />
        <Route path="/hotels/:id" element={<HotelDetailsPage />} />

        {/* Guest-only: signed-in people are sent on to their own area. */}
        <Route element={<GuestRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>

        {/* Booking flow: needs a customer account. A guest is sent to /login and
            brought back to this exact step (query string included). */}
        <Route element={<ProtectedRoute />}>
          <Route path="/booking" element={<BookingPage />} />
          <Route path="/booking/confirmation/:id" element={<BookingConfirmationPage />} />
        </Route>
      </Route>

      {/* My Account (customers only; admins are redirected to /admin). */}
      <Route element={<ProtectedRoute />}>
        <Route path="/account" element={<AccountLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="bookings" element={<MyBookingsPage />} />
          <Route path="bookings/:id" element={<BookingDetailsPage />} />
          <Route path="reviews" element={<MyReviewsPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="profile/edit" element={<EditProfilePage />} />
          <Route path="password" element={<ChangePasswordPage />} />
          <Route path="close" element={<CloseAccountPage />} />
        </Route>
      </Route>

      {/* Older URLs keep working. */}
      <Route path="/my-bookings" element={<Navigate to="/account/bookings" replace />} />
      <Route path="/profile" element={<Navigate to="/account/profile" replace />} />

      {/* Admin Panel (admins only; its own layout and navigation). */}
      <Route element={<AdminRoute />}>
        <Route element={<AdminLayout />}>
          <Route path="/admin" element={<AdminDashboardPage />} />
          <Route path="/admin/hotels" element={<AdminHotelsPage />} />
          <Route path="/admin/rooms" element={<AdminRoomsPage />} />
          <Route path="/admin/bookings" element={<AdminBookingsPage />} />
          <Route path="/admin/users" element={<AdminUsersPage />} />
          <Route path="/admin/reviews" element={<AdminReviewsPage />} />
          <Route path="/admin/profile" element={<AdminProfilePage />} />
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
