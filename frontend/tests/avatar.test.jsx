import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../src/services/uploadService', async () => {
  const actual = await vi.importActual('../src/services/uploadService');
  return { ...actual, uploadAvatar: vi.fn() };
});
vi.mock('../src/services/userService', () => ({ default: { updateProfileImage: vi.fn() } }));

import AuthContext from '../src/context/AuthContext';
import Avatar from '../src/components/ui/Avatar';
import ProfileImageManager from '../src/components/account/ProfileImageManager';
import { uploadAvatar } from '../src/services/uploadService';
import userService from '../src/services/userService';

const IMG = 'https://res.cloudinary.com/demo/image/upload/v1/stayeasy/avatars/u1.jpg';
const NEW = 'https://res.cloudinary.com/demo/image/upload/v2/stayeasy/avatars/u1.jpg';

beforeEach(() => {
  vi.clearAllMocks();
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:preview');
  globalThis.URL.revokeObjectURL = vi.fn();
});

describe('Avatar', () => {
  it('shows the initial when there is no image, and the picture when there is one', () => {
    const { rerender, container } = render(<Avatar name="tahira" />);
    expect(screen.getByRole('img', { name: /tahira's profile picture/i })).toHaveTextContent('T');
    expect(container.querySelector('img')).toBeNull();
    rerender(<Avatar name="tahira" src={IMG} />);
    expect(container.querySelector('img')).toHaveAttribute('src', IMG);
  });

  it('falls back to the initial when the picture cannot load, and retries for a new URL', () => {
    const { rerender, container } = render(<Avatar name="Sara" src={IMG} />);
    fireEvent.error(container.querySelector('img'));
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByRole('img', { name: /sara/i })).toHaveTextContent('S');
    rerender(<Avatar name="Sara" src={NEW} />);
    expect(container.querySelector('img')).toHaveAttribute('src', NEW);
  });
});

function renderManager(user) {
  const updateSession = vi.fn();
  render(
    <AuthContext.Provider value={{ user, updateSession }}>
      <ProfileImageManager />
    </AuthContext.Provider>
  );
  return { updateSession };
}

const base = { _id: 'u1', name: 'Tahira', email: 't@x.com', role: 'user', profileImage: '' };

describe('ProfileImageManager', () => {
  it('uploads, saves and pushes the saved profile (with the new image) into the session', async () => {
    uploadAvatar.mockResolvedValue(NEW);
    userService.updateProfileImage.mockResolvedValue({ ...base, profileImage: NEW });
    const { updateSession } = renderManager(base);
    const user = userEvent.setup();
    await user.upload(screen.getByLabelText('Choose a profile photo'), new File(['x'], 'me.png', { type: 'image/png' }));
    expect(await screen.findByText(/photo has been added/i)).toBeInTheDocument();
    expect(userService.updateProfileImage).toHaveBeenCalledWith(NEW);
    expect(updateSession).toHaveBeenCalledWith(expect.objectContaining({ _id: 'u1', role: 'user', profileImage: NEW }));
  });

  it('rejects a wrong type or an oversized file without any request', async () => {
    renderManager(base);
    const user = userEvent.setup({ applyAccept: false });
    await user.upload(screen.getByLabelText('Choose a profile photo'), new File(['x'], 'doc.pdf', { type: 'application/pdf' }));
    expect(await screen.findByText(/Unsupported file type/)).toBeInTheDocument();
    await user.upload(screen.getByLabelText('Choose a profile photo'), new File([new Uint8Array(6 * 1024 * 1024)], 'big.png', { type: 'image/png' }));
    expect(await screen.findByText(/Too large/)).toBeInTheDocument();
    expect(uploadAvatar).not.toHaveBeenCalled();
  });

  it('keeps the saved photo and explains when the upload or the save fails', async () => {
    uploadAvatar.mockRejectedValueOnce({ response: { status: 503 } });
    const { updateSession } = renderManager({ ...base, profileImage: IMG });
    const user = userEvent.setup();
    await user.upload(screen.getByLabelText('Choose a profile photo'), new File(['x'], 'me.png', { type: 'image/png' }));
    expect(await screen.findByText(/not available right now/i)).toBeInTheDocument();

    uploadAvatar.mockResolvedValueOnce(NEW);
    userService.updateProfileImage.mockRejectedValueOnce({ response: { status: 400, data: { message: 'Profile image must be an image uploaded to your own account' } } });
    await user.upload(screen.getByLabelText('Choose a profile photo'), new File(['x'], 'me.png', { type: 'image/png' }));
    expect(await screen.findByText(/uploaded to your own account/)).toBeInTheDocument();
    expect(updateSession).not.toHaveBeenCalled();
  });

  it('removes the photo only after confirmation', async () => {
    userService.updateProfileImage.mockResolvedValue({ ...base, profileImage: '' });
    const { updateSession } = renderManager({ ...base, profileImage: IMG });
    const user = userEvent.setup();
    expect(screen.queryByRole('button', { name: 'Upload photo' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Remove' }));
    expect(userService.updateProfileImage).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Yes, remove' }));
    await waitFor(() => expect(userService.updateProfileImage).toHaveBeenCalledWith(null));
    expect(await screen.findByText(/photo has been removed/i)).toBeInTheDocument();
    expect(updateSession).toHaveBeenCalledWith(expect.objectContaining({ profileImage: '' }));
  });
});
