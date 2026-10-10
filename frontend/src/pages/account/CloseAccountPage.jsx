import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PageHeading from '../../components/account/PageHeading';
import ConfirmDialog from '../../components/admin/ConfirmDialog';
import Notice from '../../components/ui/Notice';
import PasswordInput from '../../components/ui/PasswordInput';
import { useAuth } from '../../context/AuthContext';
import userService from '../../services/userService';
import { getApiError } from '../../utils/errors';

// DELETE /users/me. The backend anonymises the account (name becomes "Guest")
// and keeps bookings and reviews for the hotels' records — nothing is deleted
// from here. Answers handled explicitly:
//   400 wrong/missing password · 403 admin account · 409 upcoming bookings.
export default function CloseAccountPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [understood, setUnderstood] = useState(false);
  const [fieldError, setFieldError] = useState('');
  const [problem, setProblem] = useState(null); // { status, text }
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleContinue = (event) => {
    event.preventDefault();
    setProblem(null);
    if (!password) {
      setFieldError('Enter your password to continue.');
      return;
    }
    setFieldError('');
    setConfirming(true);
  };

  const handleClose = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await userService.closeAccount(password);
      // Navigate while still signed in (flushSync so it lands first), then end
      // the session — otherwise the route guard would redirect to /login.
      navigate('/', { replace: true, flushSync: true, state: { notice: 'Your account has been closed. We hope to see you again.' } });
      logout();
    } catch (err) {
      const status = err?.response?.status;
      const text = getApiError(err, 'We could not close your account. Please try again.');
      setConfirming(false);
      setSubmitting(false);
      if (status === 400) {
        setFieldError(text);
        setProblem(null);
      } else {
        setProblem({ status, text });
      }
    }
  };

  return (
    <>
      <PageHeading title="Close account" description="Permanently close your StayEasy account." />

      <section className="card acct-section acct-narrow">
        <h2>Before you go</h2>
        <ul className="plain-list">
          <li>You won&apos;t be able to sign in again, and this can&apos;t be undone.</li>
          <li>Your name and email are removed from your account. Past bookings and reviews are kept for the hotels&apos; records and appear as &quot;Guest&quot;.</li>
          <li>Closing is blocked while you have <strong>upcoming bookings</strong>. Cancel them first.</li>
        </ul>

        {problem?.status === 409 && (
          <Notice type="error">
            {problem.text} <Link to="/account/bookings">Go to My Bookings</Link>
          </Notice>
        )}
        {problem && problem.status !== 409 && (
          <Notice type="error">{problem.status === 403 ? 'Admin accounts cannot be closed from here.' : problem.text}</Notice>
        )}

        <form className="form profile-form" onSubmit={handleContinue} noValidate>
          <PasswordInput
            id="close-password"
            label="Confirm with your password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setFieldError(''); }}
            error={fieldError}
            disabled={submitting}
            required
          />
          <label className="checkbox-row">
            <input type="checkbox" checked={understood} onChange={(e) => setUnderstood(e.target.checked)} />
            <span>I understand my account will be closed permanently.</span>
          </label>
          <div className="form-actions">
            <button type="submit" className="ui-btn ui-btn-danger" disabled={!understood || !password || submitting}>
              <span className="ui-btn-label">Close my account</span>
            </button>
            <Link to="/account/profile" className="ui-btn ui-btn-outline"><span className="ui-btn-label">Keep my account</span></Link>
          </div>
        </form>
      </section>

      <ConfirmDialog
        open={confirming}
        title="Close your account?"
        description="This is permanent. You will be signed out and won't be able to sign in with this account again."
        confirmLabel="Yes, close my account"
        submitting={submitting}
        onConfirm={handleClose}
        onDismiss={() => setConfirming(false)}
      />
    </>
  );
}
