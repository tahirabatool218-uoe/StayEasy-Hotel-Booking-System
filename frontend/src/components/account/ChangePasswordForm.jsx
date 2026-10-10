import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import userService from '../../services/userService';
import PasswordInput from '../ui/PasswordInput';
import Notice from '../ui/Notice';
import { getApiError } from '../../utils/errors';

const EMPTY = { currentPassword: '', newPassword: '', confirmPassword: '' };

// PUT /users/change-password. The server answers with a fresh token (every
// older one is invalidated), which must be stored or the next request would
// sign this session out. Used by the customer Password page and Admin profile.
export default function ChangePasswordForm() {
  const { updateSession } = useAuth();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => (prev[name] ? { ...prev, [name]: undefined } : prev));
  };

  const validate = () => {
    const next = {};
    if (!form.currentPassword) next.currentPassword = 'Please enter your current password';
    if (!form.newPassword) next.newPassword = 'Please choose a new password';
    else if (form.newPassword.length < 8) next.newPassword = 'Your new password must be at least 8 characters';
    if (form.newPassword && form.newPassword !== form.confirmPassword) next.confirmPassword = 'Both passwords must match';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (saving) return;
    setMessage(null);
    if (!validate()) return;
    setSaving(true);
    try {
      const { token } = await userService.changePassword({ currentPassword: form.currentPassword, newPassword: form.newPassword });
      updateSession(null, token);
      setForm(EMPTY);
      setMessage({ type: 'success', text: 'Your password has been changed. Other devices will need to sign in again.' });
    } catch (err) {
      setMessage({ type: 'error', text: getApiError(err, 'We could not change your password. Please try again.') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="form profile-form" onSubmit={handleSubmit} noValidate>
      <Notice type={message?.type}>{message?.text}</Notice>

      <PasswordInput id="current-password" name="currentPassword" label="Current password" autoComplete="current-password" value={form.currentPassword} onChange={handleChange} error={errors.currentPassword} disabled={saving} required />
      <PasswordInput id="new-password" name="newPassword" label="New password" autoComplete="new-password" value={form.newPassword} onChange={handleChange} error={errors.newPassword} hint="At least 8 characters." disabled={saving} required />
      <PasswordInput id="confirm-password" name="confirmPassword" label="Confirm new password" autoComplete="new-password" value={form.confirmPassword} onChange={handleChange} error={errors.confirmPassword} disabled={saving} required />

      <div className="form-actions">
        <button type="submit" className="ui-btn ui-btn-primary" disabled={saving} aria-busy={saving}>
          <span className="ui-btn-label">{saving ? 'Updating…' : 'Change password'}</span>
        </button>
      </div>
    </form>
  );
}
