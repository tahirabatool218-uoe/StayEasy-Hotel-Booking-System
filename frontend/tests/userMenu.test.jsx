import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AuthContext from '../src/context/AuthContext';
import UserMenu from '../src/components/UserMenu';
import RoomFormModal from '../src/components/admin/RoomFormModal';

vi.mock('../src/components/uploads/ImageUploader', () => ({ default: () => <div data-testid="uploader" /> }));

const logout = vi.fn();
const renderMenu = (user, isAdmin = false) =>
  render(
    <AuthContext.Provider value={{ user, isAdmin, logout }}>
      <MemoryRouter>
        <UserMenu />
        <button type="button">outside</button>
      </MemoryRouter>
    </AuthContext.Provider>
  );

const guest = { _id: '1', name: 'Tahira Khan', email: 't@x.com', role: 'user', profileImage: '' };

beforeEach(() => vi.clearAllMocks());

describe('UserMenu', () => {
  it('opens a card with the person, their links and Log out; closes on outside click and Escape', async () => {
    const user = userEvent.setup();
    renderMenu(guest);
    expect(screen.queryByRole('menu')).toBeNull();

    await user.click(screen.getByRole('button', { name: /account menu for tahira khan/i }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    expect(screen.getByText('t@x.com')).toBeInTheDocument();
    expect(screen.getByText('Guest')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Dashboard' })).toHaveAttribute('href', '/account');
    expect(screen.getByRole('menuitem', { name: 'Profile' })).toHaveAttribute('href', '/account/profile');
    expect(screen.getAllByRole('menuitem')).toHaveLength(3); // Dashboard, Profile, Log out

    await user.click(screen.getByRole('button', { name: 'outside' }));
    expect(screen.queryByRole('menu')).toBeNull();

    await user.click(screen.getByRole('button', { name: /account menu/i }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('logs out from the card and shows admin links for administrators', async () => {
    const user = userEvent.setup();
    renderMenu(guest);
    await user.click(screen.getByRole('button', { name: /account menu/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Log out' }));
    expect(logout).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('lists the admin destinations for an admin', async () => {
    const user = userEvent.setup();
    renderMenu({ ...guest, role: 'admin' }, true);
    await user.click(screen.getByRole('button', { name: /account menu/i }));
    expect(screen.getByText('Administrator')).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Dashboard' })).toHaveAttribute('href', '/admin');
    expect(screen.getByRole('menuitem', { name: 'Profile' })).toHaveAttribute('href', '/admin/profile');
    expect(screen.queryByRole('menuitem', { name: 'Password' })).toBeNull();
  });
});

describe('RoomFormModal (redesigned)', () => {
  const hotels = [{ _id: 'h1', name: 'Grand', city: 'Lahore' }];

  it('validates required fields, then submits the same payload shape as before', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<RoomFormModal room={null} hotels={hotels} open onClose={() => {}} onSubmit={onSubmit} />);

    await user.click(screen.getByRole('button', { name: 'Create room' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getAllByText('This field is required').length).toBe(3);
    expect(screen.getByText('Enter a price of 0 or more')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Room number'), '201');
    await user.type(screen.getByLabelText('Room type'), 'Deluxe');
    await user.type(screen.getByLabelText('Price per night'), '120');
    await user.type(screen.getByLabelText('Description'), 'Nice room');
    await user.click(screen.getByRole('radio', { name: /maintenance/i }));
    await user.click(screen.getByRole('button', { name: /wifi/i }));
    await user.click(screen.getByRole('button', { name: /balcony/i }));
    await user.click(screen.getByRole('button', { name: /wifi/i })); // toggles off again
    await user.click(screen.getByRole('button', { name: 'Create room' }));

    expect(onSubmit).toHaveBeenCalledWith({
      hotel: 'h1',
      roomNumber: '201',
      roomType: 'Deluxe',
      description: 'Nice room',
      pricePerNight: 120,
      capacity: 2,
      status: 'maintenance',
      amenities: ['balcony'],
      images: [],
    });
  });

  it('asks for a hotel first when none exist', () => {
    render(<RoomFormModal room={null} hotels={[]} open onClose={() => {}} onSubmit={() => {}} />);
    expect(screen.getByText(/Add a hotel first/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create room' })).toBeDisabled();
  });
});
