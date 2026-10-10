import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../src/services/uploadService', async () => {
  const actual = await vi.importActual('../src/services/uploadService');
  return { ...actual, uploadImage: vi.fn() };
});
import { uploadImage } from '../src/services/uploadService';
import ImageUploader from '../src/components/uploads/ImageUploader';

const jpg = (name) => new File(['x'], name, { type: 'image/jpeg' });

function Harness({ initial = [] }) {
  const [images, setImages] = useState(initial);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <ImageUploader images={images} onChange={setImages} onBusyChange={setBusy} />
      <output data-testid="urls">{images.join('|')}</output>
      <output data-testid="busy">{String(busy)}</output>
    </>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:preview');
  globalThis.URL.revokeObjectURL = vi.fn();
});

describe('ImageUploader', () => {
  it('uploads several files, appends their HTTPS URLs and keeps existing images', async () => {
    uploadImage.mockImplementation(async (file) => `https://res.cloudinary.com/demo/${file.name}`);
    const user = userEvent.setup();
    render(<Harness initial={['https://example.com/old.jpg']} />);
    await user.upload(screen.getByLabelText('Choose image files to upload'), [jpg('a.jpg'), jpg('b.jpg')]);
    await waitFor(() => expect(screen.getByTestId('urls').textContent.split('|')).toHaveLength(3));
    const urls = screen.getByTestId('urls').textContent.split('|');
    expect(urls[0]).toBe('https://example.com/old.jpg');
    expect(urls).toContain('https://res.cloudinary.com/demo/a.jpg');
    expect(urls).toContain('https://res.cloudinary.com/demo/b.jpg');
    await waitFor(() => expect(screen.getByTestId('busy').textContent).toBe('false'));
  });

  it('rejects wrong types before any request is made', async () => {
    const user = userEvent.setup({ applyAccept: false });
    render(<Harness />);
    await user.upload(screen.getByLabelText('Choose image files to upload'), new File(['x'], 'doc.pdf', { type: 'application/pdf' }));
    expect(await screen.findByText(/doc\.pdf: Unsupported file type/)).toBeInTheDocument();
    expect(uploadImage).not.toHaveBeenCalled();
  });

  it('shows a per-file error with retry, and a configuration error on 503', async () => {
    uploadImage.mockRejectedValueOnce({ response: { status: 503 } });
    const user = userEvent.setup();
    render(<Harness />);
    await user.upload(screen.getByLabelText('Choose image files to upload'), jpg('a.jpg'));
    expect(await screen.findAllByText(/not configured on the server/i)).not.toHaveLength(0);
    uploadImage.mockResolvedValueOnce('https://res.cloudinary.com/demo/a.jpg');
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    await waitFor(() => expect(screen.getByTestId('urls').textContent).toBe('https://res.cloudinary.com/demo/a.jpg'));
  });

  it('removes an image and refuses non-HTTPS URLs when adding by URL', async () => {
    const user = userEvent.setup();
    render(<Harness initial={['https://example.com/one.jpg', 'https://example.com/two.jpg']} />);
    await user.click(screen.getByRole('button', { name: 'Remove image 1' }));
    expect(screen.getByTestId('urls').textContent).toBe('https://example.com/two.jpg');
    await user.type(screen.getByLabelText('Or add an image by URL'), 'http://insecure.test/x.jpg');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(await screen.findByText(/starting with https/)).toBeInTheDocument();
    expect(screen.getByTestId('urls').textContent).toBe('https://example.com/two.jpg');
  });

  it('enforces the 20-image limit', async () => {
    const user = userEvent.setup();
    const full = Array.from({ length: 20 }, (_, i) => `https://example.com/${i}.jpg`);
    render(<Harness initial={full} />);
    expect(screen.getByRole('button', { name: 'Choose images' })).toBeDisabled();
    expect(screen.getByText('20 of 20')).toBeInTheDocument();
    expect(user).toBeDefined();
  });
});
