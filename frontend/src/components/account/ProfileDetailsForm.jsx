import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import userService from '../../services/userService';
import Notice from '../ui/Notice';
import { getApiError } from '../../utils/errors';

const EMAIL_RE = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

// Edit name + email (PUT /users/profile). Shared by the customer "Edit profile"
// page and the Admin profile page. The session is updated from the server's
// reply, so the navbar and sidebars show the saved values immediately.
export default function ProfileDetailsForm({ cancelTo }) {
  const { user, updateSession } = useAuth();
  const [form, setForm] = useState(() => ({ name: user?.name || '', email: user?.email || '' }));
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
    if (!form.name.trim()) next.name = 'Please enter your name';
    if (!form.email.trim()) next.email = 'Please enter your email';
    else if (!EMAIL_RE.test(form.email.trim())) next.email = 'Please enter a valid email';
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
      const updated = await userService.updateProfile({ name: form.name.trim(), email: form.email.trim().toLowerCase() });
      updateSession({ _id: updated._id, name: updated.name, email: updated.email, role: updated.role, profileImage: updated.profileImage || '' });
      setForm({ name: updated.name, email: updated.email });
      setMessage({ type: 'success', text: 'Your profile has been updated.' });
    } catch (err) {
      const status = err?.response?.status;
      setMessage({
        type: 'error',
        text: status === 409 ? 'That email address is already in use.' : getApiError(err, 'We could not update your profile. Please try again.'),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="form profile-form" onSubmit={handleSubmit} noValidate>
      <Notice type={message?.type}>{message?.text}</Notice>

      <div className="form-field">
        <label htmlFor="profile-name">Full name</label>
        <input id="profile-name" name="name" type="text" autoComplete="name" value={form.name} onChange={handleChange} aria-invalid={Boolean(errors.name)} disabled={saving} required />
        {errors.name && <span className="form-error" role="alert">{errors.name}</span>}
      </div>

      <div className="form-field">
        <label htmlFor="profile-email">Email</label>
        <input id="profile-email" name="email" type="email" autoComplete="email" value={form.email} onChange={handleChange} aria-invalid={Boolean(errors.email)} disabled={saving} required />
        {errors.email && <span className="form-error" role="alert">{errors.email}</span>}
      </div>

      <div className="form-actions">
        <button type="submit" className="ui-btn ui-btn-primary" disabled={saving} aria-busy={saving}>
          <span className="ui-btn-label">{saving ? 'Saving…' : 'Save changes'}</span>
        </button>
        {cancelTo && (
          <Link to={cancelTo} className="ui-btn ui-btn-outline">
            <span className="ui-btn-label">Back</span>
          </Link>
        )}
      </div>
    </form>
  );
}
