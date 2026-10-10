import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import PasswordInput from '../../components/ui/PasswordInput';
import { getPostLoginPath } from '../../utils/auth';
import { getApiError } from '../../utils/errors';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // Set by the route guards: the page (and query string, e.g. a half-finished
  // booking) the visitor was trying to reach before being asked to sign in.
  const from = location.state?.from;

  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setError('');
    setSubmitting(true);
    try {
      const session = await login({ email: form.email.trim(), password: form.password });
      // Admins land on the Admin Dashboard; users return to the step they came
      // from (or their dashboard).
      navigate(getPostLoginPath(session, from), { replace: true });
    } catch (err) {
      const status = err.response?.status;
      setError(
        status === 403
          ? getApiError(err, 'This account has been deactivated. Please contact support.')
          : getApiError(err, 'Unable to log in. Please try again.')
      );
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <h1>Welcome back</h1>
          <p className="auth-subtitle">
            {from?.pathname?.startsWith('/booking') ? 'Sign in to finish your booking' : 'Sign in to continue your journey'}
          </p>
        </div>

        {error && <div className="error-banner" role="alert">{error}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="email">Email address</label>
            <div className="input-wrapper">
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={handleChange}
                required
                placeholder="you@example.com"
                disabled={submitting}
              />
            </div>
          </div>

          <PasswordInput
            id="password"
            name="password"
            label="Password"
            autoComplete="current-password"
            value={form.password}
            onChange={handleChange}
            required
            placeholder="Enter your password"
            disabled={submitting}
          />

          <button type="submit" className="ui-btn ui-btn-primary ui-btn-block auth-submit" disabled={submitting} aria-busy={submitting}>
            <span className="ui-btn-label">{submitting ? 'Signing in…' : 'Sign in'}</span>
          </button>
        </form>

        <p className="auth-footer">
          Don&apos;t have an account? <Link to="/register" state={from ? { from } : undefined}>Create one</Link>
        </p>
      </div>
    </div>
  );
}
