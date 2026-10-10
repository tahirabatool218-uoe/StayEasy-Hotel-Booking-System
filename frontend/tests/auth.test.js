import { describe, expect, it } from 'vitest';
import { getPostLoginPath } from '../src/utils/auth';

const user = { role: 'user' };
const admin = { role: 'admin' };

describe('getPostLoginPath', () => {
  it('sends admins to the Admin Dashboard by default', () => {
    expect(getPostLoginPath(admin)).toBe('/admin');
  });
  it('sends admins to the admin page they asked for', () => {
    expect(getPostLoginPath(admin, { pathname: '/admin/users', search: '?page=2' })).toBe('/admin/users?page=2');
  });
  it('never sends an admin to a customer page (e.g. a booking step)', () => {
    expect(getPostLoginPath(admin, { pathname: '/booking', search: '?hotel=1' })).toBe('/admin');
  });
  it('sends users to their dashboard by default', () => {
    expect(getPostLoginPath(user)).toBe('/account');
  });
  it('returns a user to the exact booking step, query string included', () => {
    const from = { pathname: '/booking', search: '?hotel=h1&room=r1&checkIn=2026-11-01&checkOut=2026-11-03&guests=2' };
    expect(getPostLoginPath(user, from)).toBe('/booking?hotel=h1&room=r1&checkIn=2026-11-01&checkOut=2026-11-03&guests=2');
  });
  it('never sends a user to an admin page or back to /login', () => {
    expect(getPostLoginPath(user, { pathname: '/admin' })).toBe('/account');
    expect(getPostLoginPath(user, { pathname: '/login' })).toBe('/account');
  });
});
