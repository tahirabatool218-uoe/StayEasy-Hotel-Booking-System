import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import AuthContext from '../src/context/AuthContext';
import ProtectedRoute from '../src/routes/ProtectedRoute';
import GuestRoute from '../src/routes/GuestRoute';
import AdminRoute from '../src/routes/AdminRoute';

const session = (role) =>
  role
    ? { isAuthenticated: true, isAdmin: role === 'admin', loading: false, user: { _id: '1', name: 'T', role } }
    : { isAuthenticated: false, isAdmin: false, loading: false, user: null };

function Where() {
  const { pathname, search, state } = useLocation();
  return <p data-testid="where">{pathname}{search}|{state?.from ? `from:${state.from.pathname}${state.from.search}` : ''}</p>;
}

function renderAt(path, role) {
  return render(
    <AuthContext.Provider value={session(role)}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route element={<GuestRoute />}>
            <Route path="/login" element={<Where />} />
          </Route>
          <Route element={<ProtectedRoute />}>
            <Route path="/account" element={<Where />} />
            <Route path="/booking" element={<Where />} />
          </Route>
          <Route element={<AdminRoute />}>
            <Route path="/admin" element={<Where />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>
  );
}

const where = () => screen.getByTestId('where').textContent;

describe('route guards', () => {
  it('guest -> /account redirects to /login', () => {
    renderAt('/account', null);
    expect(where()).toContain('/login');
  });
  it('guest at the booking step is sent to /login remembering the exact step', () => {
    renderAt('/booking?hotel=h1&room=r1', null);
    expect(where()).toBe('/login|from:/booking?hotel=h1&room=r1');
  });
  it('guest -> /admin redirects to /login', () => {
    renderAt('/admin', null);
    expect(where()).toContain('/login');
  });
  it('user can open My Account and the booking step', () => {
    renderAt('/account', 'user');
    expect(where()).toContain('/account');
  });
  it('user cannot open /admin', () => {
    renderAt('/admin', 'user');
    expect(where()).toContain('/account');
  });
  it('admin cannot open customer pages and is sent to /admin', () => {
    renderAt('/account', 'admin');
    expect(where()).toContain('/admin');
    renderAt('/booking', 'admin');
  });
  it('signed-in user visiting /login is sent to the dashboard; admin to /admin', () => {
    renderAt('/login', 'user');
    expect(where()).toContain('/account');
  });
  it('signed-in admin visiting /login is sent to /admin', () => {
    renderAt('/login', 'admin');
    expect(where()).toContain('/admin');
  });
});
