import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import PasswordInput from '../../components/ui/PasswordInput';
import { getPostLoginPath } from '../../utils/auth';
import { getApiError } from '../../utils/errors';

const passwordChecks = [
  { label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { label: 'One uppercase letter', test: (p) => /[A-Z]/.test(p) },
  { label: 'One lowercase letter', test: (p) => /[a-z]/.test(p) },
  { label: 'One number', test: (p) => /[0-9]/.test(p) },
  { label: 'One special character', test: (p) => /[^A-Za-z0-9]/.test(p) },
];

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from;

  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setError('');
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setSubmitting(true);
    try {
      const session = await register({ name: form.name.trim(), email: form.email.trim(), password: form.password });
      navigate(getPostLoginPath(session, from), { replace: true });
    } catch (err) {
      setError(getApiError(err, 'Unable to create your account.'));
      setSubmitting(false);
    }
  };

  const passwordScore = passwordChecks.filter((c) => c.test(form.password)).length;
  const passwordStrength = passwordScore <= 1 ? 'weak' : passwordScore <= 3 ? 'fair' : passwordScore <= 4 ? 'good' : 'strong';
  const mismatch = form.confirmPassword && form.password !== form.confirmPassword;

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <h1>Create an account</h1>
          <p className="auth-subtitle">Book hotels faster with a free account</p>
        </div>

        {error && <div className="error-banner" role="alert">{error}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-field">
            <label htmlFor="name">Full name</label>
            <div className="input-wrapper">
              <input id="name" name="name" type="text" autoComplete="name" value={form.name} onChange={handleChange} required placeholder="John Doe" disabled={submitting} />
            </div>
          </div>

          <div className="form-field">
            <label htmlFor="email">Email address</label>
            <div className="input-wrapper">
              <input id="email" name="email" type="email" autoComplete="email" value={form.email} onChange={handleChange} required placeholder="you@example.com" disabled={submitting} />
            </div>
          </div>

          {/* Each PasswordInput owns its visibility state: the two toggles are independent. */}
          <PasswordInput
            id="password"
            name="password"
            label="Password"
            autoComplete="new-password"
            minLength={8}
            value={form.password}
            onChange={handleChange}
            required
            placeholder="Create a strong password"
            disabled={submitting}
          >
            {form.password && (
              <div className="password-strength">
                <div className="strength-bar">
                  <div className={`strength-fill ${passwordStrength}`} style={{ width: `${(passwordScore / passwordChecks.length) * 100}%` }} />
                </div>
                <div className="strength-checks">
                  {passwordChecks.map((check) => (
                    <span key={check.label} className={check.test(form.password) ? 'pass' : 'fail'}>
                      {check.label}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </PasswordInput>

          <PasswordInput
            id="confirmPassword"
            name="confirmPassword"
            label="Confirm password"
            autoComplete="new-password"
            value={form.confirmPassword}
            onChange={handleChange}
            required
            placeholder="Confirm your password"
            disabled={submitting}
            error={mismatch ? 'Passwords do not match' : ''}
          />

          <button type="submit" className="ui-btn ui-btn-primary ui-btn-block auth-submit" disabled={submitting} aria-busy={submitting}>
            <span className="ui-btn-label">{submitting ? 'Creating account…' : 'Create account'}</span>
          </button>
        </form>

        <p className="auth-footer">
          Already have an account? <Link to="/login" state={from ? { from } : undefined}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}
