import { forwardRef, useId, useState } from 'react';
import { FiEye, FiEyeOff } from 'react-icons/fi';

// Password field with its OWN show/hide toggle. Every instance keeps its own
// visibility state, so two fields on one form (password + confirmation) never
// reveal each other. Hidden by default. The toggle is a real <button>, so Enter
// and Space work, it has a visible focus ring, and aria-pressed/aria-label
// announce its state to assistive technology.
const PasswordInput = forwardRef(function PasswordInput(
  { label, error, hint, id, className = '', children, ...rest },
  ref
) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;
  const [visible, setVisible] = useState(false);
  const noun = label ? label.toLowerCase() : 'password';

  return (
    <div className={`form-field ${className}`}>
      {label && <label htmlFor={inputId}>{label}</label>}
      <div className="input-wrapper input-wrapper--password">
        <input
          ref={ref}
          id={inputId}
          type={visible ? 'text' : 'password'}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={describedBy}
          {...rest}
        />
        <button
          type="button"
          className="password-toggle"
          onClick={() => setVisible((prev) => !prev)}
          aria-label={`${visible ? 'Hide' : 'Show'} ${noun}`}
          aria-pressed={visible}
          aria-controls={inputId}
          disabled={rest.disabled}
        >
          {visible ? <FiEyeOff size={18} aria-hidden="true" /> : <FiEye size={18} aria-hidden="true" />}
        </button>
      </div>
      {error ? (
        <span id={`${inputId}-error`} className="form-error" role="alert">{error}</span>
      ) : hint ? (
        <span id={`${inputId}-hint`} className="form-hint">{hint}</span>
      ) : null}
      {children}
    </div>
  );
});

export default PasswordInput;
