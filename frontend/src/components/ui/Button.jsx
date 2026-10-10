import { forwardRef } from 'react';

// Generic action button. `as="link"` renders an anchor-like element via
// react-router's Link when `to` is provided by the caller (kept out of this
// component to avoid a hard react-router dependency here); by default it
// renders a native <button>.
const Button = forwardRef(function Button(
  { variant = 'primary', size = 'md', loading = false, fullWidth = false, className = '', children, disabled, ...rest },
  ref
) {
  const classes = [
    'ui-btn',
    `ui-btn-${variant}`,
    size !== 'md' ? `ui-btn-${size}` : '',
    fullWidth ? 'ui-btn-block' : '',
    loading ? 'is-loading' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button ref={ref} className={classes} disabled={disabled || loading} aria-busy={loading} {...rest}>
      {loading && <span className="ui-btn-spinner" aria-hidden="true" />}
      <span className="ui-btn-label">{children}</span>
    </button>
  );
});

export default Button;
