import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PasswordInput from '../src/components/ui/PasswordInput';

describe('PasswordInput', () => {
  it('is hidden by default and toggles with an accessible, keyboard-operable button', async () => {
    const user = userEvent.setup();
    render(<PasswordInput label="Password" defaultValue="secret" />);
    const input = screen.getByLabelText('Password');
    const toggle = screen.getByRole('button', { name: 'Show password' });
    expect(input).toHaveAttribute('type', 'password');
    expect(toggle).toHaveAttribute('aria-pressed', 'false');

    toggle.focus();
    await user.keyboard('{Enter}');
    expect(input).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute('aria-pressed', 'true');

    await user.keyboard(' ');
    expect(input).toHaveAttribute('type', 'password');
  });

  it('keeps two fields independent', async () => {
    const user = userEvent.setup();
    render(
      <>
        <PasswordInput label="Password" />
        <PasswordInput label="Confirm password" />
      </>
    );
    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text');
    expect(screen.getByLabelText('Confirm password')).toHaveAttribute('type', 'password');
  });
});
