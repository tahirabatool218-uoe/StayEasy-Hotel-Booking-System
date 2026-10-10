import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import userService from '../../services/userService';
import { getApiError } from '../../utils/errors';

export default function ProfilePage() {
  const { user, updateSession } = useAuth();

  // ---- Profile (name + email) ------------------------------------------
  // Seeded from the cached profile so the fields are editable straight away.
  const [profile, setProfile] = useState(() => ({ name: user?.name || '', email: user?.email || '' }));
  const [profileErrors, setProfileErrors] = useState({});
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState(null); // { type, message }

  // ---- Password --------------------------------------------------------
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordErrors, setPasswordErrors] = useState({});
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState(null);

  const handleProfileChange = (event) => {
    const { name, value } = event.target;
    setProfile((prev) => ({ ...prev, [name]: value }));
    setProfileErrors((prev) => (prev[name] ? { ...prev, [name]: undefined } : prev));
  };

  const handlePasswordChange = (event) => {
    const { name, value } = event.target;
    setPasswords((prev) => ({ ...prev, [name]: value }));
    setPasswordErrors((prev) => (prev[name] ? { ...prev, [name]: undefined } : prev));
  };

  const validateProfile = () => {
    const next = {};
    if (!profile.name.trim()) next.name = 'Please enter your name';
    if (!profile.email.trim()) next.email = 'Please enter your email';
    else if (!/^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(profile.email.trim())) next.email = 'Please enter a valid email';
    setProfileErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleProfileSubmit = async (event) => {
    event.preventDefault();
    setProfileMessage(null);
    if (!validateProfile()) return;

    setSavingProfile(true);
    try {
      const updated = await userService.updateProfile({
        name: profile.name.trim(),
        email: profile.email.trim().toLowerCase(),
      });
      // Keep the navbar avatar, the name in the header and the cached profile
      // in step with what the server now holds.
      updateSession({
        _id: updated._id,
        name: updated.name,
        email: updated.email,
        role: updated.role,
      });
      setProfileMessage({ type: 'success', message: 'Your profile has been updated.' });
    } catch (err) {
      setProfileMessage({ type: 'error', message: getApiError(err, 'We could not update your profile. Please try again.') });
    } finally {
      setSavingProfile(false);
    }
  };

  const validatePasswords = () => {
    const next = {};
    if (!passwords.currentPassword) next.currentPassword = 'Please enter your current password';
    if (!passwords.newPassword) next.newPassword = 'Please choose a new password';
    else if (passwords.newPassword.length < 8) next.newPassword = 'Your new password must be at least 8 characters';
    if (passwords.newPassword && passwords.newPassword !== passwords.confirmPassword) {
      next.confirmPassword = 'Both passwords must match';
    }
    setPasswordErrors(next);
    return Object.keys(next).length === 0;
  };

  const handlePasswordSubmit = async (event) => {
    event.preventDefault();
    setPasswordMessage(null);
    if (!validatePasswords()) return;

    setSavingPassword(true);
    try {
      const { token: freshToken } = await userService.changePassword({
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword,
      });
      // The server rotated our token; store it so this session survives.
      updateSession(null, freshToken);
      setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setPasswordMessage({ type: 'success', message: 'Your password has been changed.' });
    } catch (err) {
      setPasswordMessage({ type: 'error', message: getApiError(err, 'We could not change your password. Please try again.') });
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="profile-page">
      <div className="profile-header">
        <h1>Profile</h1>
        <p>Your account details, and the password you sign in with.</p>
      </div>

      <section className="card profile-section">
        <h2>Account details</h2>
        <p className="form-hint">
          Signed in as <strong>{user?.email}</strong>
          {user?.role ? ` — ${user.role}` : ''}.
        </p>

        {profileMessage && (
          <div className={profileMessage.type === 'success' ? 'success-banner' : 'error-banner'} role="alert">
            {profileMessage.message}
          </div>
        )}

        <form className="form profile-form" onSubmit={handleProfileSubmit} noValidate>
          <div className="form-field">
            <label htmlFor="profile-name">Full name</label>
            <input
              id="profile-name"
              name="name"
              type="text"
              autoComplete="name"
              value={profile.name}
              onChange={handleProfileChange}
              required
            />
            {profileErrors.name && <span className="form-error">{profileErrors.name}</span>}
          </div>

          <div className="form-field">
            <label htmlFor="profile-email">Email</label>
            <input
              id="profile-email"
              name="email"
              type="email"
              autoComplete="email"
              value={profile.email}
              onChange={handleProfileChange}
              required
            />
            {profileErrors.email && <span className="form-error">{profileErrors.email}</span>}
          </div>

          <button type="submit" className="ui-btn ui-btn-primary" disabled={savingProfile}>
            <span className="ui-btn-label">{savingProfile ? 'Saving…' : 'Save changes'}</span>
          </button>
        </form>
      </section>

      <section className="card profile-section">
        <h2>Change password</h2>

        {passwordMessage && (
          <div className={passwordMessage.type === 'success' ? 'success-banner' : 'error-banner'} role="alert">
            {passwordMessage.message}
          </div>
        )}

        <form className="form profile-form" onSubmit={handlePasswordSubmit} noValidate>
          <div className="form-field">
            <label htmlFor="current-password">Current password</label>
            <input
              id="current-password"
              name="currentPassword"
              type="password"
              autoComplete="current-password"
              value={passwords.currentPassword}
              onChange={handlePasswordChange}
              required
            />
            {passwordErrors.currentPassword && <span className="form-error">{passwordErrors.currentPassword}</span>}
          </div>

          <div className="form-field">
            <label htmlFor="new-password">New password</label>
            <input
              id="new-password"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={passwords.newPassword}
              onChange={handlePasswordChange}
              required
            />
            {passwordErrors.newPassword ? (
              <span className="form-error">{passwordErrors.newPassword}</span>
            ) : (
              <span className="form-hint">At least 8 characters.</span>
            )}
          </div>

          <div className="form-field">
            <label htmlFor="confirm-password">Confirm new password</label>
            <input
              id="confirm-password"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              value={passwords.confirmPassword}
              onChange={handlePasswordChange}
              required
            />
            {passwordErrors.confirmPassword && <span className="form-error">{passwordErrors.confirmPassword}</span>}
          </div>

          <button type="submit" className="ui-btn ui-btn-primary" disabled={savingPassword}>
            <span className="ui-btn-label">{savingPassword ? 'Updating…' : 'Change password'}</span>
          </button>
        </form>
      </section>
    </div>
  );
}